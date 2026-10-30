"""What AT-SPI gives a screen reader, recorded the way Orca reads it.

Started by `check-accessibility-tree.ts`. Prints one JSON object per line:

  {"kind": "ready"}
  {"kind": "event", "type": ..., "detail1": ..., "text": ..., "node": {...},
   "ancestors": [...]}

`node` and each ancestor are {role, name, description, states, attributes}.
`text` is what was inserted, for `object:text-changed:insert`. `ancestors` is
the chain from the parent up to the document, given for focus events and
text insertions, since that is where a screen reader looks to say which
dialog the focus entered and which live region the text is in.

Documented: the events and object attributes are those Core-AAM 1.2 maps for
ATK/AT-SPI2, https://w3c.github.io/core-aam/ (state changes, `text_changed`,
`object:property-change:accessible-name`, `live`/`container-live`).
"""

import json
import sys

import gi

gi.require_version("Atspi", "2.0")
from gi.repository import Atspi, GLib  # noqa: E402

# The object attributes a contract reads. The rest are left out of the record.
ATTRIBUTES = ("id", "tag", "live", "container-live", "atomic", "container-atomic", "relevant")


def describe(acc):
    if acc is None:
        return None
    try:
        role = acc.get_role_name()
        name = acc.get_name() or ""
        description = acc.get_description() or ""
    except GLib.Error:
        return None
    try:
        raw = acc.get_attributes() or {}
    except GLib.Error:
        raw = {}
    try:
        states = sorted(Atspi.StateType(s).value_nick for s in acc.get_state_set().get_states())
    except GLib.Error:
        states = []
    return {
        "role": role,
        "name": name,
        "description": description,
        "states": states,
        "attributes": {k: raw[k] for k in ATTRIBUTES if k in raw},
    }


def ancestors(acc):
    chain = []
    current = acc
    for _ in range(60):
        try:
            current = current.get_parent()
        except GLib.Error:
            break
        if current is None:
            break
        described = describe(current)
        if described is None:
            break
        chain.append(described)
        if described["role"] in ("document web", "frame", "application"):
            break
    return chain


def emit(obj):
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


WITH_ANCESTORS = (
    "object:state-changed:focused",
    "object:text-changed:insert",
    "object:children-changed:add",
)

EMBEDDED = "￼"


def flatten(acc, depth=0):
    """The text of a node with its embedded objects read out, as Orca does:
    in AT-SPI a child element sits in its parent's text as U+FFFC, and the
    hypertext interface says which child each one is."""
    if acc is None or depth > 20:
        return ""
    try:
        text_iface = acc.get_text_iface()
    except GLib.Error:
        text_iface = None
    if text_iface is None:
        # A node that is gone by the time it is read, as a closed toast is.
        try:
            return acc.get_name() or ""
        except GLib.Error:
            return ""
    try:
        text = Atspi.Text.get_text(acc, 0, Atspi.Text.get_character_count(acc))
    except GLib.Error:
        return ""
    return expand(acc, text, 0, depth)


def expand(acc, text, offset, depth):
    if EMBEDDED not in text:
        return text
    out = []
    for i, char in enumerate(text):
        if char != EMBEDDED:
            out.append(char)
            continue
        try:
            index = Atspi.Hypertext.get_link_index(acc, offset + i)
            link = Atspi.Hypertext.get_link(acc, index) if index >= 0 else None
            child = Atspi.Hyperlink.get_object(link, 0) if link is not None else None
        except GLib.Error:
            child = None
        out.append(flatten(child, depth + 1))
    return "".join(out)


focused = {"acc": None}


def on_event(event):
    if event.type.startswith("object:state-changed:focused") and event.detail1 == 1:
        focused["acc"] = event.source
    text = None
    embedding = False
    if event.type.startswith("object:text-changed"):
        try:
            text = event.any_data if isinstance(event.any_data, str) else str(event.any_data)
        except Exception:  # noqa: BLE001
            text = None
        # Firefox inserts a new element as an embedded object; the text a
        # screen reader speaks is the child's.
        if text and EMBEDDED in text:
            # Only embedded objects: a child element was inserted, and its own
            # text may arrive as an event of its own as well.
            embedding = text.strip(EMBEDDED) == ""
            text = expand(event.source, text, event.detail1, 0)
    elif event.type.startswith("object:children-changed:add"):
        # A child that arrives with its text already in it comes as a new
        # child, not as inserted text. In a live region a screen reader speaks
        # the child's text, so it is read out the same way.
        embedding = True
        child = event.any_data if isinstance(event.any_data, Atspi.Accessible) else None
        text = flatten(child) if child is not None else None
    emit({
        "kind": "event",
        "type": event.type,
        "detail1": event.detail1,
        "text": text,
        "embedding": embedding,
        "node": describe(event.source),
        "ancestors": ancestors(event.source) if event.type.startswith(WITH_ANCESTORS) else [],
    })


def on_stdin(source, condition):
    """"forget": a new page, so no node has focus yet.

    "focused <tag>": the node that last got focus, as it is now: name,
    description and states read again, since a field can turn invalid while
    the focus stays on it. Answered after every event before the command."""
    line = sys.stdin.readline()
    if not line:
        Atspi.event_quit()
        return False
    parts = line.strip().split(" ", 1)
    if parts[0] == "forget":
        focused["acc"] = None
    elif parts[0] == "focused":
        acc = focused["acc"]
        # AT-SPI keeps a cache on this side, updated by the browser's events.
        # A browser that changes a description without sending the event
        # leaves the old value there, so the answer is read past it, from the
        # browser. Whether the event came is checked separately.
        if acc is not None:
            try:
                acc.clear_cache()
            except GLib.Error:
                pass
        emit({
            "kind": "focused",
            "tag": parts[1] if len(parts) > 1 else "",
            "node": describe(acc),
            "ancestors": ancestors(acc) if acc is not None else [],
        })
    return True


Atspi.init()
listener = Atspi.EventListener.new(on_event)
# The AT-SPI states the contracts can name come from the conductor, which
# reads them from ATSPI_STATES in platform.ts.
STATES = sys.argv[1:]
if not STATES:
    sys.exit("recorder.py: no states given")
for event_type in (
    *(f"object:state-changed:{state}" for state in STATES),
    "object:text-changed:insert",
    "object:children-changed:add",
    "object:property-change:accessible-name",
    "object:property-change:accessible-description",
    # The document's tree is complete: before this, the browser folds changes
    # into the tree it is building, and a live region is not a region yet.
    "document:load-complete",
):
    listener.register(event_type)
GLib.io_add_watch(sys.stdin, GLib.IO_IN | GLib.IO_HUP, on_stdin)
emit({"kind": "ready"})
Atspi.event_main()
