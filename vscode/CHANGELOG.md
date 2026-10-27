# Changes in LO-TEK for VS Code

The extension has its own version number. It does not follow the package,
since it only changes when an element or an attribute does.

## 0.10.1

- The snippets are one snippet file, `lotek.code-snippets`, with the
  twenty languages as the scope of every snippet, instead of twenty
  contributions with a language each. VS Code reported "Unknown language"
  in the extension's runtime status for every contributed language no
  installed extension registers, sixteen of the twenty on a machine with
  none of the template-language extensions. The snippets worked where the
  language existed; the marks were the only symptom. A scope is read when
  the snippet is offered and never validated, so the marks are gone, and
  nothing else changes: the same snippets, in the same languages, through
  VS Code's own snippet service. As before, the snippets apply in the
  twenty languages of the default list and do not follow a changed
  `lotek.languages`.

## 0.10.0

In step with the package's 0.37.0, the first under the `lt-` prefix. The
first version under this name. It takes over from the earlier extension,
and the history starts here.

- Completion of the `<lt-*>` elements, their attributes and the allowed
  values, and of the `lt-` classes inside `class="…"`, with the values a
  class takes, such as `data-variant` on `lt-button`.
- Hover over an `lt-` class, and in HTML files over an element or an
  attribute, with a link to the component page.
- Snippets with the markup from the component pages, with the id as a tab
  stop that `for` and `href` follow.
- Diagnostics and quick fixes from the language server, `lotek lsp`, which
  ships with the extension and needs nothing installed. It checks against
  the LO-TEK version the project has installed, or the manifest the Gradle
  plugin writes, so components taken over with `lotek takeover` are known.
- The same in the template languages: PHP, Razor, Astro, Svelte, Vue, Twig,
  Blade, Jinja, Django, Handlebars, ERB, Go templates, EJS, Liquid, Nunjucks
  and Edge, set with `lotek.languages`.
