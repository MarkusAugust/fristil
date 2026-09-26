/**
 * At diagnostikken feller hver feiltype den skal, og bare dem.
 *
 * Elementene leses fra generatoren i minnet, ikke fra `elements.json` på
 * disk, så sjekken bruker den samme kilden som utvidelsen ville fått etter
 * `bun run generate`. Hvert tilfelle sier hvor mange funn det skal gi og
 * hva meldingen skal nevne, og de rene tilfellene skal gi null. Snippetene
 * fra komponentsidene er med som rene tilfeller: gir en av dem funn, er
 * enten regelen eller oppskriften feil, og begge deler skal fram.
 *
 * Tilfellene dekker også parseren, ikke bare reglene: en verdi med `>` i,
 * en verdi uten anførselstegn, enkle anførselstegn, en tagg over flere
 * linjer, et felt uten lukketagg. En gren uten tilfelle overlever at den
 * fjernes, og da vet ingen at den virker.
 *
 * Kjør med: bun scripts/sjekk-diagnostikk.ts
 */

import { diagnose, type Elements } from "../src/diagnostics"
import { diagnosticsData, snippets } from "./generate"

const all: Elements = diagnosticsData()
const findings: string[] = []

type Case = {
  name: string
  html: string
  count: number
  mentions?: string[]
  severity?: "error" | "warning"
  /** Teksten funnet skal dekke, når posisjonen er poenget. */
  covers?: string
}

const FIELD_OK = `<fs-field id="f"><label>Navn</label><input class="fs-input" name="navn"></fs-field>`

const cases: Case[] = [
  {
    name: "et element som ikke finnes",
    html: `<fs-dialog><fs-dialog-header>Tittel</fs-dialog-header></fs-dialog>`,
    count: 1,
    mentions: ["<fs-dialog-header> finnes ikke", "fs-dialog"],
    severity: "error",
    covers: "fs-dialog-header",
  },
  {
    name: "et attributt elementet ikke har",
    html: `<fs-popover placemnet="top-start"></fs-popover>`,
    count: 1,
    mentions: ["«placemnet»", "placement"],
    severity: "warning",
    covers: "placemnet",
  },
  {
    name: "globale attributter, data-, aria- og hendelser slipper gjennom",
    html: `<fs-popover id="p" class="x" data-on-click="@get('/x')" aria-label="Hjelp" onclick="1" role="dialog" hidden></fs-popover>`,
    count: 0,
  },
  {
    name: "HTMX, Alpine og Vue sine prefikser slipper gjennom",
    html: `<fs-popover hx-get="/x" x-data="{}" v-if="c"></fs-popover>`,
    count: 0,
  },
  {
    name: "Alpine, Svelte og Angular sine tegn slipper gjennom",
    html: `<fs-popover @click="a" :open="b" on:click="d" bind:open="e" [open]="f" (close)="g"></fs-popover>`,
    count: 0,
  },
  {
    name: "Alpine i taggen gjør ikke resten til en mal",
    html: `<fs-popover @click="a" placemnet="top-start"></fs-popover>`,
    count: 1,
    mentions: ["«placemnet»"],
  },
  {
    name: "en Razor-partial inne i feltet",
    html: `<fs-field><label>Navn</label>@Html.Partial("Input")</fs-field>`,
    count: 0,
  },
  {
    name: "en verdi utenfor lista",
    html: `<fs-field required-marker="stjerne"><label>N</label><input></fs-field>`,
    count: 1,
    mentions: ["«stjerne»", "Lovlige verdier"],
    severity: "error",
    covers: "required-marker",
  },
  {
    name: "et listeattributt uten verdi",
    html: `<fs-field required-marker><label>N</label><input></fs-field>`,
    count: 1,
    mentions: ["Lovlige verdier"],
    severity: "error",
  },
  {
    name: "et boolsk attributt med «false»",
    html: `<fs-field invalid="false"><label>N</label><input></fs-field>`,
    count: 1,
    mentions: ["boolsk", 'invalid="false" betyr det samme som invalid'],
    severity: "warning",
  },
  {
    name: "et boolsk attributt med sitt eget navn eller tom verdi er greit",
    html: `<fs-field invalid="invalid" disabled=""><label>N</label><input></fs-field>`,
    count: 0,
  },
  {
    name: "hidden=until-found er HTML",
    html: `<fs-error-summary hidden="until-found"></fs-error-summary>`,
    count: 0,
  },
  {
    name: "et tall som ikke er et tall",
    html: `<fs-toast duration="lenge"></fs-toast>`,
    count: 1,
    mentions: ["skal være et tall", "«lenge»"],
    severity: "error",
  },
  {
    name: "et tall som er et tall",
    html: `<fs-toast duration="5000"></fs-toast>`,
    count: 0,
  },
  {
    name: "et felt uten kontroll",
    html: `<fs-field><label>Navn</label><p class="fs-help-text">Hjelp</p></fs-field>`,
    count: 1,
    mentions: ["fant ingen kontroll", "<input>, <textarea> eller <select>"],
    severity: "warning",
    covers: "fs-field",
  },
  {
    name: "en skjult input er ingen kontroll, som i komponenten",
    html: `<fs-field><label>X</label><input type="hidden" name="csrf"></fs-field>`,
    count: 1,
    mentions: ["fant ingen kontroll"],
  },
  {
    name: "kontrollen etter en skjult input teller",
    html: `<fs-field><input type="hidden" name="csrf"><input aria-label="Søk"></fs-field>`,
    count: 0,
  },
  {
    name: "et felt uten ledetekst",
    html: `<fs-field><input class="fs-input"></fs-field>`,
    count: 1,
    mentions: ["fant ingen <label>", "uten navn"],
    severity: "warning",
  },
  {
    name: "et tomt felt er et område serveren ikke har fylt",
    html: `<fs-field id="senere"></fs-field>`,
    count: 0,
  },
  {
    name: "ledetekst utenfor, med for",
    html: `<label for="epost">E-post</label><fs-field><input id="epost"></fs-field>`,
    count: 0,
  },
  {
    name: "ledetekst utenfor via control-id",
    html: `<label for="epost">E-post</label><fs-field control-id="epost"><input></fs-field>`,
    count: 0,
  },
  {
    name: "en id med klammer og parenteser kaster ikke",
    html: `<label for="a[0].x(1)">X</label><fs-field><input id="a[0].x(1)"></fs-field>`,
    count: 0,
  },
  {
    name: "punktum i id-en er et punktum, ikke hva som helst",
    html: `<label for="ab">X</label><fs-field><input id="a.b"></fs-field>`,
    count: 1,
    mentions: ["fant ingen <label>"],
  },
  {
    name: "aria-label på kontrollen",
    html: `<fs-field><input aria-label="Søk"></fs-field>`,
    count: 0,
  },
  {
    name: "aria-labelledby på kontrollen",
    html: `<fs-field><input aria-labelledby="tittel"></fs-field>`,
    count: 0,
  },
  {
    name: "Go-mal i taggen",
    html: `<fs-field {{ if .Feil }}invalid{{ end }}><label>N</label><input></fs-field>`,
    count: 0,
  },
  {
    name: "Jinja i taggen og i verdien",
    html: `<fs-popover {% if x %}open{% endif %} placement="{{ p }}"></fs-popover>`,
    count: 0,
  },
  {
    name: "PHP i taggen",
    html: `<fs-field <?= $invalid ? 'invalid' : '' ?>><label>N</label><input></fs-field>`,
    count: 0,
  },
  {
    name: "Razor i verdien",
    html: `<fs-field invalid="@Model.Invalid"><label>N</label><input></fs-field>`,
    count: 0,
  },
  {
    name: "en partial inne i feltet er ikke et felt uten kontroll",
    html: `<fs-field><label>Navn</label>{{ template "input" . }}</fs-field>`,
    count: 0,
  },
  {
    name: "et ukjent element meldes også i en mal",
    html: `<fs-feild {{ if .X }}invalid{{ end }}></fs-feild>`,
    count: 1,
    mentions: ["finnes ikke"],
  },
  {
    name: "kommentarer, skript og stilark leses ikke",
    html: `<!-- <fs-finnes-ikke> --><script>"<fs-nei>"</script><style>/* <fs-nei> */</style>${FIELD_OK}`,
    count: 0,
  },
  {
    name: "posisjonen står selv om en kommentar går over flere linjer",
    html: `<!--\n<fs-nei>\n-->\n<fs-tull></fs-tull>`,
    count: 1,
    covers: "fs-tull",
  },
  {
    name: "store bokstaver i tagg og attributt, og selvlukking",
    html: `<FS-TOAST DURATION="x"/>`,
    count: 1,
    mentions: ["skal være et tall"],
    covers: "DURATION",
  },
  {
    name: "en verdi med > i",
    html: `<fs-toast label="a > b" duration="5"></fs-toast>`,
    count: 0,
  },
  {
    name: "en verdi uten anførselstegn",
    html: `<fs-popover placement=top-start></fs-popover><fs-popover placement=topp></fs-popover>`,
    count: 1,
    mentions: ["«topp»"],
  },
  {
    name: "enkle anførselstegn",
    html: `<fs-popover placement='top-start'></fs-popover><fs-popover placement='topp'></fs-popover>`,
    count: 1,
    mentions: ["«topp»"],
  },
  {
    name: "en tagg over flere linjer",
    html: `<fs-popover\n  placement="top-start"\n  open\n></fs-popover>`,
    count: 0,
  },
  {
    name: "felt i felt",
    html: `<fs-field><label>A</label><input><fs-field><label>B</label><input></fs-field></fs-field>`,
    count: 0,
  },
  {
    name: "et felt uten lukketagg",
    html: `<fs-field><label>A</label><input>`,
    count: 0,
  },
  {
    name: "flere funn i samme tagg meldes hver for seg",
    html: `<fs-popover placemnet="top-start" open="false"></fs-popover>`,
    count: 2,
  },
  {
    name: "en ren fil",
    html: `<!doctype html><html><body>${FIELD_OK}<fs-popover placement="top-start" open></fs-popover></body></html>`,
    count: 0,
  },
]

// Snippetene fra komponentsidene skal være rene.
for (const [tag, snippet] of Object.entries(snippets()))
  cases.push({
    name: `snippeten for <${tag}>`,
    html: snippet.body.join("\n").replace(/\\\$/g, "$").replace(/\\\\/g, "\\"),
    count: 0,
  })

for (const c of cases) {
  const fail = (message: string) => findings.push(`${c.name}: ${message}`)
  let found: ReturnType<typeof diagnose>
  try {
    found = diagnose(c.html, all)
  } catch (error) {
    fail(`kastet: ${error instanceof Error ? error.message : String(error)}`)
    continue
  }
  if (found.length !== c.count) {
    fail(
      `ventet ${c.count} funn, fikk ${found.length}: ${found.map((f) => f.message).join(" | ") || "ingen"}`,
    )
    continue
  }
  if (!found.length) continue
  const first = found[0]
  for (const m of c.mentions ?? [])
    if (!first.message.includes(m))
      fail(`meldingen nevner ikke «${m}»: ${first.message}`)
  if (c.severity && first.severity !== c.severity)
    fail(`ventet ${c.severity}, fikk ${first.severity}`)
  if (c.covers) {
    const covered = c.html.slice(first.start, first.end)
    if (covered !== c.covers)
      fail(`funnet dekker «${covered}», ikke «${c.covers}»`)
  }
  if (!first.link.startsWith("https://fristil.netlify.app/"))
    fail(`lenken peker ikke på dokumentasjonen: ${first.link}`)
}

if (findings.length) {
  console.error(
    `Diagnostikken feiler på ${findings.length} punkt:\n  ${findings.join("\n  ")}`,
  )
  process.exit(1)
}
console.log(
  `Diagnostikken består ${cases.length} tilfeller, ${Object.keys(all).length} elementer.`,
)
