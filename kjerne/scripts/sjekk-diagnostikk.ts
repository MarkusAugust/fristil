/**
 * At kjernen feller hver feiltype den skal, og bare dem.
 *
 * Kjernen er Rust-modulen slik `bun run kjerne` sist bygget den, med
 * pakkens manifest. En regel som er skrudd av i Rust, feller her etter
 * neste bygg av modulen. Hvert tilfelle sier hvor mange funn det skal gi og
 * hva meldingen skal nevne, og de rene tilfellene skal gi null. Snippetene
 * fra komponentsidene er med som rene tilfeller: gir en av dem funn, er
 * enten regelen eller oppskriften feil, og begge deler skal fram.
 *
 * Tilfellene dekker også parseren, ikke bare reglene: en verdi med `>` i,
 * en verdi uten anførselstegn, enkle anførselstegn, en tagg over flere
 * linjer, et felt uten lukketagg. En gren uten tilfelle overlever at den
 * fjernes, og da vet ingen at den virker.
 *
 * Kjør med: bun kjerne/scripts/sjekk-diagnostikk.ts (etter bun kjerne/scripts/bygg.ts)
 */

import { readFileSync } from "node:fs"
import {
  classesData,
  diagnosticsData,
  snippets,
} from "../../designsystem/scripts/generate-ordforrad"
import {
  type Finding,
  loadCore,
} from "../../designsystem/src/diagnostics/core.js"
import type {
  Classes,
  Elements,
} from "../../designsystem/src/vocabulary/types.js"
import { MODUL } from "./bygg.js"

const all: Elements = diagnosticsData()
const classes: Classes = classesData()
const core = loadCore(readFileSync(MODUL))
// Kjernen bærer ingen data, og får pakkens manifest som hver vert gir den.
core.loadManifest(
  readFileSync(
    new URL("../../designsystem/manifest/manifest.json", import.meta.url),
    "utf8",
  ),
)
const findings: string[] = []

type Case = {
  name: string
  html: string
  count: number
  mentions?: string[]
  severity?: "error" | "warning"
  /** Teksten funnet skal dekke, når posisjonen er poenget. */
  covers?: string
  /**
   * Der funnet skal begynne. Trengs når den samme teksten står flere steder:
   * `covers` alene består da også når funnet peker på feil forekomst.
   */
  coversAt?: number
  /** Det meldingen ikke skal nevne. */
  notMentions?: string[]
  /** Rettelsen anvendt på html skal gi dette. */
  fixed?: string
  fixTitle?: string
  fixPreferred?: boolean
  /** Funnet skal ikke ha noen rettelse. */
  noFix?: boolean
  /** Hvor lang tid tilfellet får, når farten er poenget. */
  maxMs?: number
  /** Sjekk som en hel side, med reglene for koblingen. */
  page?: boolean
}

const FIELD_OK = `<fs-field id="f"><label for="navn">Navn</label><input class="fs-input" name="navn" id="navn"></fs-field>`

const cases: Case[] = [
  {
    name: "en knapp med bare et ikon og ikke noe navn",
    html: `<button class="fs-button"><svg class="fs-icon" aria-hidden="true"><path d="M0 0"/></svg><span aria-hidden="true">x</span></button>`,
    count: 1,
    mentions: ["<button> har bare et ikon", "aria-label", "fs-sr-only"],
    severity: "error",
    covers: "button",
    coversAt: 1,
  },
  {
    name: "en lenke med bare et bilde uten alt",
    html: `<a href="/hjem"><img src="hus.svg" alt=""></a>`,
    count: 1,
    mentions: ["<a> har bare et ikon", "«lenke»"],
    severity: "error",
  },
  {
    name: "et ikon med navn fra tekst, aria-label, title, alt eller svg-tittel",
    html: `<button><svg class="fs-icon" aria-hidden="true"></svg> Slett</button>
<button aria-label="Slett"><svg class="fs-icon" aria-hidden="true"></svg></button>
<button title="Slett"><svg class="fs-icon" aria-hidden="true"></svg></button>
<button><svg class="fs-icon" aria-hidden="true"></svg><span class="fs-sr-only">Slett</span></button>
<button><img src="x.svg" alt="Slett"></button>
<button><svg><title>Slett</title></svg></button>
<a><svg class="fs-icon" aria-hidden="true"></svg></a>
<button hidden><svg class="fs-icon" aria-hidden="true"></svg></button>
<button>{{ .Navn }}<svg class="fs-icon" aria-hidden="true"></svg></button>
<button></button>`,
    count: 0,
  },
  {
    name: "et felt med to kontroller",
    html: `<fs-field><label for="a">Telefon</label><input name="a" id="a"><select name="b"></select></fs-field>`,
    count: 1,
    mentions: [
      "<fs-field> har delen «control» mer enn én gang",
      "bare den første",
    ],
    severity: "warning",
    covers: "select",
  },
  {
    name: "to hjelpetekster i et felt, der bare den første kobles",
    html: `<fs-field><label for="n">Navn</label><input name="n" id="n"><p class="fs-help-text">A</p><p class="fs-help-text">B</p></fs-field>`,
    count: 1,
    mentions: ["«help»"],
    coversAt: 90,
  },
  {
    name: "en klasse med to av en del som skal stå én gang",
    html: `<table class="fs-table"><caption>A</caption><caption>B</caption><thead></thead><tbody></tbody></table>`,
    count: 1,
    mentions: ["fs-table har delen «caption»", "skal stå én gang"],
    coversAt: 45,
  },
  {
    name: "deler som står flere ganger der det er lov, eller hører til noe annet",
    html: `<fs-popover><button>Meny</button><ul class="fs-popover" id="meny"><li><button>A</button></li><li><button>B</button></li></ul></fs-popover>
<fs-dialog><dialog><h2>Tittel</h2><div class="fs-dialog__body"><h3>Del</h3></div></dialog></fs-dialog>
<fs-field><label>A <input name="a"></label><fs-field><label>B <input name="b"></label></fs-field></fs-field>
<fs-tabs><ul class="fs-tabs__list" aria-label="Deler"><li><a href="#pa">A</a></li><li><a href="#pb">B</a></li></ul><div class="fs-tabs__panel" id="pa">A</div><div class="fs-tabs__panel" id="pb">B</div></fs-tabs>
<div class="fs-card"><h3 class="fs-card__title">A</h3><div class="fs-card"><h3 class="fs-card__title">B</h3></div></div>
<ul class="fs-list"><li>A</li><li>B</li></ul>`,
    count: 0,
  },
  {
    name: "to dialoger rett under <fs-dialog>, men ikke en nøstet",
    html: `<fs-dialog><dialog></dialog><dialog></dialog></fs-dialog>
<fs-dialog><dialog></dialog><div><dialog></dialog></div></fs-dialog>`,
    count: 1,
    mentions: ["«dialog»"],
  },
  {
    name: "en skjult verdi er ikke en kontroll til, og en delt knapp er ikke to utløsere",
    html: `<fs-field><input type="hidden" name="x"><label><input type="checkbox" name="y"> Jeg godtar</label></fs-field>
<fs-popover><button type="button">Lagre</button><button type="button" aria-controls="m">Flere valg</button><ul class="fs-popover" id="m"><li><button type="button">Lagre som</button></li></ul></fs-popover>
<fieldset class="fs-fieldset"><legend class="fs-legend">Adresse</legend><p class="fs-help-text">Der du bor</p><fs-field><label for="g">Gate</label><input name="g" id="g"><p class="fs-help-text">Med nummer</p></fs-field></fieldset>
<table class="fs-table"><caption>A</caption><thead></thead><tbody></tbody><tbody></tbody></table>`,
    count: 0,
  },
  {
    name: "en dyp nøsting og et felt med mange kontroller går fort",
    html: `<ul class="fs-list">${"<li>x".repeat(3000)}</ul><fs-field><label for="a">A</label><input name="a" id="a">${'<input name="a">'.repeat(1999)}</fs-field>`,
    count: 1999,
    maxMs: 500,
  },
  {
    name: "to deler bak et vilkår i en mal er ikke to deler",
    html: `<fs-field><label>Svar</label>{{if .Lang}}<textarea name="s"></textarea>{{else}}<input name="s">{{end}}</fs-field>`,
    count: 0,
  },
  {
    name: "en del til kan undertrykkes",
    html: `<fs-field><label for="a">A</label><input name="a" id="a"><!-- fristil-ignore-next del-flere-ganger --><input name="b"></fs-field>`,
    count: 0,
  },
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
    name: "Angulars strukturdirektiver og i18n, og hyperscripts _, slipper gjennom",
    html: `<fs-popover *ngIf="x" i18n placement="top-start"></fs-popover><fs-dialog _="on click toggle @open"></fs-dialog>`,
    count: 0,
  },
  {
    name: "en web component som begynner på select er ingen kontroll",
    html: `<fs-field><label-x>N</label-x><select-all></select-all></fs-field>`,
    count: 1,
    mentions: ["fant ingen kontroll"],
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
    html: `<fs-popover placement="midt"></fs-popover>`,
    count: 1,
    mentions: ["«midt»", "Lovlige verdier"],
    severity: "error",
    covers: "placement",
  },
  {
    name: "et listeattributt uten verdi",
    html: `<fs-popover placement></fs-popover>`,
    count: 1,
    mentions: ["Lovlige verdier"],
    severity: "error",
  },
  {
    name: "et boolsk attributt med «false»",
    html: `<fs-field disabled="false"><label>N <input></label></fs-field>`,
    count: 1,
    mentions: ["boolsk", 'disabled="false" betyr det samme som disabled'],
    severity: "warning",
  },
  {
    name: "et boolsk attributt med sitt eget navn eller tom verdi er greit",
    html: `<fs-field disabled="disabled" optional=""><label>N <input></label></fs-field>`,
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
    name: "et varsel om økten uten dialog, slik det ble skrevet før",
    html: `<fs-session-timeout warn-at="1500"></fs-session-timeout>`,
    count: 1,
    mentions: ["fant ingen <dialog>", "uten advarsel"],
    severity: "warning",
    covers: "fs-session-timeout",
  },
  {
    name: "et varsel om økten med dialog",
    html: `<fs-session-timeout><dialog><h2>Snart ute</h2></dialog></fs-session-timeout>`,
    count: 0,
  },
  {
    name: "et varsel om økten uten lukketagg, med en annen dialog lenger ned",
    html: `<fs-session-timeout warn-at="1500">\n<fs-dialog><dialog><h2>Annet</h2></dialog></fs-dialog>`,
    count: 0,
  },
  {
    name: "et varsel om økten der dialogen står i en partial",
    html: `<fs-session-timeout>{{ template "okt" . }}</fs-session-timeout>`,
    count: 0,
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
    name: "ledetekst utenfor, med for uten anførselstegn",
    html: `<label for=epost>E-post</label><fs-field><input id="epost"></fs-field>`,
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
    html: `<fs-field {{ if .Av }}disabled{{ end }}><label>N</label><input></fs-field>`,
    count: 0,
  },
  {
    name: "Jinja i taggen og i verdien",
    html: `<fs-popover {% if x %}open{% endif %} placement="{{ p }}"></fs-popover>`,
    count: 0,
  },
  {
    name: "PHP i taggen",
    html: `<fs-field <?= $av ? 'disabled' : '' ?>><label>N <input></label></fs-field>`,
    count: 0,
  },
  {
    name: "Razor i verdien",
    html: `<fs-field disabled="@Model.Disabled"><label>N <input></label></fs-field>`,
    count: 0,
  },
  {
    name: "en partial inne i feltet er ikke et felt uten kontroll",
    html: `<fs-field><label>Navn</label>{{ template "input" . }}</fs-field>`,
    count: 0,
  },
  {
    name: "et ukjent element meldes også i en mal",
    html: `<fs-feild {{ if .X }}disabled{{ end }}></fs-feild>`,
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
    html: `<fs-field><label>A <input></label><fs-field><label>B <input></label></fs-field></fs-field>`,
    count: 0,
  },
  {
    name: "et felt uten lukketagg",
    html: `<fs-field><label>A <input></label>`,
    count: 0,
  },
  {
    name: "Alpine på kontrollen gjør ikke feltet til en mal",
    html: `<fs-field><input @input="x = 1"></fs-field>`,
    count: 1,
    mentions: ["fant ingen <label>"],
  },
  {
    name: "Alpine på en knapp i feltet heller",
    html: `<fs-field><label>N</label><button @click="x">Send</button></fs-field>`,
    count: 1,
    mentions: ["fant ingen kontroll"],
  },
  {
    name: "store bokstaver i felt: tomt felt er stille",
    html: `<FS-FIELD id="senere"></FS-FIELD>\n<p>tekst</p>`,
    count: 0,
  },
  {
    name: "store bokstaver i felt: uten ledetekst felles",
    html: `<FS-FIELD><INPUT></FS-FIELD>\n<label>x</label>`,
    count: 1,
    mentions: ["fant ingen <label>"],
  },
  {
    name: "en skrivefeil som ligner et kjent attributt",
    html: `<fs-connection-status onlinetext="Tilkoblet"></fs-connection-status>`,
    count: 1,
    mentions: ["Mente du online-text?"],
    covers: "onlinetext",
  },
  {
    name: "en skrivefeil uten bindestrek",
    html: `<fs-field describedBy="vilkar"><label>N <input></label></fs-field>`,
    count: 1,
    mentions: ["Mente du described-by?"],
  },
  {
    name: "en uavsluttet kontroll leser ikke resten som sine attributter",
    html: `<fs-field><input placeholder=it's><span aria-label="x"></span></fs-field>`,
    count: 1,
    mentions: ["fant ingen"],
  },
  {
    name: "tall slik komponentene leser dem",
    html: `<fs-toast duration=" 5000 "></fs-toast><fs-toast duration="1e3"></fs-toast><fs-toast duration=""></fs-toast>`,
    count: 1,
    mentions: ["skal være et tall"],
  },
  {
    name: "en Jinja-kommentar i taggen",
    html: `<fs-popover {# note #} placement="top-start"></fs-popover>`,
    count: 0,
  },
  {
    name: "PHP i taggen avslutter den ikke, og feilen etter felles",
    html: `<fs-popover <?= $x ?> placement="midt"></fs-popover>`,
    count: 1,
    mentions: ["«midt»"],
  },
  {
    name: "en klasse som ikke finnes, med forslag og rettelse",
    html: `<button class="fs-buton">Send</button>`,
    count: 1,
    mentions: ["«fs-buton» finnes ikke", "Mente du fs-button?"],
    severity: "warning",
    covers: "fs-buton",
    fixed: `<button class="fs-button">Send</button>`,
    fixTitle: "Bytt til fs-button",
  },
  {
    name: "en klasse langt fra alle kjente får ikke forslag",
    html: `<button class="fs-knapp">Send</button>`,
    count: 1,
    mentions: ["«fs-knapp» finnes ikke"],
    notMentions: ["Mente du"],
  },
  {
    name: "en ren verdi i en tagg med mal sjekkes likevel",
    html: `<button class="fs-button" {{ if .X }}disabled{{ end }} data-variant="ghots"></button>`,
    count: 1,
    mentions: ["«ghots»"],
  },
  {
    name: "en klasse med mal i navnet er ingen skrivefeil",
    html: `<div class="fs-{{ .Type }} kort"></div><div class="fs-<?= $x ?>"></div>`,
    count: 0,
  },
  {
    name: "kjente klasser, også flere i samme attributt og med mal",
    html: `<input class="fs-input fs-search" type="search"><div class="{{ .Klasse }} fs-card"></div><p class="kort fs-paragraph"></p>`,
    count: 0,
  },
  {
    name: "en variant utenfor lista, med forslag og rettelse",
    html: `<button class="fs-button" data-variant="ghots">Send</button>`,
    count: 1,
    mentions: [
      "data-variant kan ikke være «ghots» på button",
      "secondary, ghost, danger",
      "primary uten attributt",
    ],
    fixed: `<button class="fs-button" data-variant="ghost">Send</button>`,
    fixTitle: "Bytt til ghost",
  },
  {
    name: "lovlige varianter, standardverdien og type på input",
    html: `<button class="fs-button" data-variant="danger"></button><button class="fs-button" data-variant="primary"></button><input class="fs-input" type="email"><h2 class="fs-heading" data-size="xl"></h2>`,
    count: 0,
  },
  {
    name: "et attributt en annen klasse tar, sjekkes ikke her",
    html: `<div class="fs-card" data-variant="ghost"></div><span class="fs-badge" data-size="xl"></span>`,
    count: 1,
    mentions: ["data-variant kan ikke være «ghost» på card"],
  },
  {
    name: "variantverdi fra en mal sjekkes ikke",
    html: `<button class="fs-button" data-variant="{{ .Variant }}"></button><button class="fs-button" data-variant="@Model.V"></button>`,
    count: 0,
  },
  {
    name: "rettelsen for et attributtnavn",
    html: `<fs-connection-status onlinetext="Tilkoblet"></fs-connection-status>`,
    count: 1,
    fixed: `<fs-connection-status online-text="Tilkoblet"></fs-connection-status>`,
    fixTitle: "Bytt til online-text",
  },
  {
    name: "rettelsen for et boolsk attributt tar med verdien og mellomrommet",
    html: `<fs-field disabled="false" id="x"><label>N <input></label></fs-field>`,
    count: 1,
    fixed: `<fs-field id="x"><label>N <input></label></fs-field>`,
    fixTitle: "Ta bort disabled",
    fixPreferred: true,
  },
  {
    name: "rettelsen for et boolsk attributt sist i taggen",
    html: `<fs-field id="x" disabled="false"><label>N <input></label></fs-field>`,
    count: 1,
    fixed: `<fs-field id="x"><label>N <input></label></fs-field>`,
  },
  {
    name: "rettelsen for et felt uten ledetekst",
    html: `<fs-field><input class="fs-input" id="navn"></fs-field>`,
    count: 1,
    fixed: `<fs-field><label for="navn">Ledetekst</label><input class="fs-input" id="navn"></fs-field>`,
    fixTitle: "Sett inn en ledetekst",
  },
  {
    // En `<label>` uten `for` ved siden av feltet er ikke koblet til det.
    // Uten id finnes ingen rettelse som er én innsetting.
    name: "et felt uten ledetekst og uten id får ingen rettelse",
    html: `<fs-field><input class="fs-input"></fs-field>`,
    count: 1,
    mentions: ["legg <label> rundt feltet"],
    noFix: true,
  },
  {
    name: "ledeteksten får sin egen linje med samme innrykk",
    html: `<fs-field>\n  <input class="fs-input" id="navn">\n</fs-field>`,
    count: 1,
    fixed: `<fs-field>\n  <label for="navn">Ledetekst</label>\n  <input class="fs-input" id="navn">\n</fs-field>`,
  },
  {
    name: "ledeteksten får sin egen linje også med \\r-linjeskift",
    html: `<fs-field>\r  <input class="fs-input" id="navn">\r</fs-field>`,
    count: 1,
    fixed: `<fs-field>\r  <label for="navn">Ledetekst</label>\r  <input class="fs-input" id="navn">\r</fs-field>`,
  },
  {
    name: "data-required på ledetekst og legend",
    html: `<label class="fs-label" data-required="stjerne">N</label><legend class="fs-legend" data-required="text">G</legend>`,
    count: 1,
    mentions: ["data-required kan ikke være «stjerne»", "symbol, text"],
  },
  {
    name: "data-variant på input, som CSS-en leser",
    html: `<input class="fs-input" data-variant="dato" type="date"><input class="fs-input" data-variant="date" type="date">`,
    count: 1,
    mentions: [
      "data-variant kan ikke være «dato»",
      "date, datetime-local, time",
    ],
    fixed: `<input class="fs-input" data-variant="date" type="date"><input class="fs-input" data-variant="date" type="date">`,
  },
  {
    name: "type på input er HTML sitt eget, og sjekkes ikke, heller ikke hidden",
    html: `<input class="fs-input" type="color"><input class="fs-input" type="hidden"><input class="fs-input" type="file">`,
    count: 0,
  },
  {
    name: "et kort navn får ikke forslag to tegn unna",
    html: `<div class="fs-tabs"></div>`,
    count: 1,
    notMentions: ["Mente du"],
  },
  {
    name: "en byttet plass er én feil, og forslaget er ikke foretrukket",
    html: `<button class="fs-button" data-variant="ghots"></button>`,
    count: 1,
    fixTitle: "Bytt til ghost",
    fixPreferred: false,
  },
  {
    name: "samme bokstaver er den sikre rettelsen",
    html: `<fs-connection-status onlinetext="x"></fs-connection-status>`,
    count: 1,
    mentions: ["Mente du online-text"],
    fixPreferred: true,
  },
  {
    name: "et langt navn får to tegns slingring",
    html: `<p class="fs-eror-txt"></p>`,
    count: 1,
    mentions: ["Mente du fs-error-text?"],
  },
  {
    name: "lengdefilteret slipper gjennom akkurat på grensen",
    html: `<a class="fs-lin"></a>`,
    count: 1,
    mentions: ["Mente du fs-link?"],
  },
  {
    name: "ved lik avstand vinner den som deler begynnelsen",
    html: `<table class="fs-tabel"></table>`,
    count: 1,
    mentions: ["Mente du fs-table?"],
  },
  {
    name: "«Ta bort» over flere linjer",
    html: `<fs-field\n  disabled="false"\n  id="x"><label>N <input></label></fs-field>`,
    count: 1,
    fixed: `<fs-field\n  id="x"><label>N <input></label></fs-field>`,
  },
  {
    name: "rettelse på en klasse uten anførselstegn",
    html: `<p class=fs-buton></p>`,
    count: 1,
    fixed: `<p class=fs-button></p>`,
  },
  {
    name: "rettelse på en verdi uten anførselstegn",
    html: `<button class=fs-button data-variant=ghots></button>`,
    count: 1,
    fixed: `<button class=fs-button data-variant=ghost></button>`,
  },
  {
    name: "to klasser som tar samme attributt gir ett funn",
    html: `<input class="fs-input fs-search" data-state="ugyldig">`,
    count: 1,
  },
  {
    name: "Astro og Svelte: en verdi i klammer er et uttrykk",
    html: `<fs-popover placement={placement} open={isOpen}></fs-popover><fs-toast duration={ms}></fs-toast><button class="fs-button" data-variant={v}></button>`,
    count: 0,
  },
  {
    name: "Astro og Svelte: klammer med anførselstegn og nøsting inni",
    html: `<input class="fs-input" data-state={feil ? "invalid" : undefined}><fs-field class:list={["fs-card", { kort }]}></fs-field>`,
    count: 0,
  },
  {
    name: "en klamme inne i et anførselstegn i uttrykket avslutter det ikke",
    html: `<fs-popover placement={a ? "}" : "x"} open></fs-popover>`,
    count: 0,
  },
  {
    name: "klammer i klammer, og feilen etter dem felles fortsatt",
    html: `<fs-popover placement={c ? {a:1}.p : "top-start"} plasement="x"></fs-popover>`,
    count: 1,
    mentions: ["«plasement»"],
  },
  {
    name: "Svelte: en klasse med et uttrykk i sjekkes ikke, de andre gjør",
    html: `<div class="fs-card fs-{b} fs-buton"></div>`,
    count: 1,
    mentions: ["«fs-buton»"],
  },
  {
    name: "klammeverdi og så en ekte feil etter",
    html: `<fs-popover open={isOpen} placemnet="top-start"></fs-popover>`,
    count: 1,
    mentions: ["«placemnet»"],
    covers: "placemnet",
  },
  {
    name: "en tom verdi er ingen verdi",
    html: `<button class="fs-button" data-variant=""></button>`,
    count: 0,
  },
  {
    name: "samme bokstaver i en klasse er den sikre rettelsen",
    html: `<p class="fs-error_text"></p>`,
    count: 1,
    fixTitle: "Bytt til fs-error-text",
    fixPreferred: true,
  },
  {
    name: "samme ukjente klasse mange ganger går fort",
    html: Array.from(
      { length: 3000 },
      () => `<td class="fs-cell fs-celle">x</td>`,
    ).join("\n"),
    count: 6000,
    maxMs: 60,
  },
  {
    name: "funnene kommer i tekstens rekkefølge",
    html: `<fs-popover placemnet="x"></fs-popover><button class="fs-buton"></button><fs-tull></fs-tull>`,
    count: 3,
    mentions: ["placemnet"],
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

// Koblingen på en hel side, med `--rendret` eller en adresse.
const LABELLED = `<label class="fs-label" for="epost">E-post</label><input class="fs-input" id="epost" aria-describedby="epost-help"><p class="fs-help-text" id="epost-help">Hjelp</p>`
cases.push(
  {
    name: "side: et rent felt med ledetekst og hjelpetekst",
    html: LABELLED,
    count: 0,
    page: true,
  },
  {
    name: "side: for peker på en id som ikke finnes",
    html: `<label class="fs-label" for="e-post">E-post</label><input class="fs-input" id="epost">`,
    count: 2,
    page: true,
    severity: "error",
    mentions: ["for=", "«e-post»", "ledeteksten", "fs.field({ id })"],
    covers: "e-post",
  },
  {
    name: "side: én av flere id-er i aria-describedby finnes ikke",
    html: LABELLED.replace(
      'aria-describedby="epost-help"',
      'aria-describedby="epost-help epost-feil"',
    ),
    count: 1,
    page: true,
    severity: "error",
    mentions: ["«epost-feil»", "beskrivelsen"],
    covers: "epost-feil",
  },
  {
    name: "side: aria-labelledby peker på en id som ikke finnes",
    html: `<input class="fs-input" id="sok" aria-labelledby="sok-tittel">`,
    count: 1,
    page: true,
    mentions: ["aria-labelledby", "navnet"],
  },
  {
    name: "side: aria-controls får ingen oppskrift om feltet",
    html: `<button class="fs-button" aria-controls="meny">Meny</button>`,
    count: 1,
    page: true,
    mentions: ["aria-controls", "«meny»"],
    notMentions: ["fs.field("],
  },
  {
    name: "side: en id som står to ganger",
    html: `${LABELLED}<p id="epost">Igjen</p>`,
    count: 1,
    page: true,
    severity: "error",
    mentions: ['id="epost"', "mer enn én gang"],
    covers: "epost",
  },
  {
    name: "side: et Fristil-felt uten ledetekst",
    html: `<label class="fs-label">Navn</label><input class="fs-input" id="navn">`,
    count: 1,
    page: true,
    severity: "warning",
    mentions: ["<input> har ingen ledetekst", "fs.field({ id })"],
    covers: "input",
  },
  {
    name: "side: et felt med <label> rundt har ledetekst",
    html: `<label class="fs-label">Navn <input class="fs-input"></label>`,
    count: 0,
    page: true,
  },
  {
    name: "side: et felt med aria-label har ledetekst",
    html: `<input class="fs-input fs-search" type="search" aria-label="Søk">`,
    count: 0,
    page: true,
  },
  {
    name: "side: et skjult felt og en sendeknapp trenger ingen ledetekst",
    html: `<input class="fs-input" type="hidden" name="t"><input class="fs-button" type="submit" value="Send">`,
    count: 0,
    page: true,
  },
  {
    name: "side: bar markup inni <fs-field> er riktig",
    html: `<fs-field><label class="fs-label" for="navn">Navn</label><input class="fs-input" id="navn"><p class="fs-help-text">Hjelp</p><p class="fs-error-text" hidden>Feil</p></fs-field>`,
    count: 0,
    page: true,
  },
  {
    name: "side: en id som peker feil inni <fs-field>, meldes likevel, og ledeteksten er da ikke koblet",
    html: `<fs-field><label class="fs-label" for="x">Navn</label><input class="fs-input" id="y"></fs-field>`,
    count: 2,
    page: true,
    mentions: ["«x»"],
  },
  {
    name: "side: en hjelpetekst uten id",
    html: `<label class="fs-label" for="a">A</label><input class="fs-input" id="a"><p class="fs-help-text">Hjelp</p>`,
    count: 1,
    page: true,
    severity: "warning",
    mentions: ["Hjelpeteksten", "har ingen id"],
  },
  {
    name: "side: en synlig feilmelding som ingen peker på",
    html: `<label class="fs-label" for="a">A</label><input class="fs-input" id="a"><p class="fs-error-text" id="a-feil">Feil</p>`,
    count: 1,
    page: true,
    mentions: ["Feilmeldingen", "«a-feil»"],
  },
  {
    name: "side: en skjult feilmelding trenger ingen kobling",
    html: `<label class="fs-label" for="a">A</label><input class="fs-input" id="a"><p class="fs-error-text" id="a-feil" hidden>Feil</p>`,
    count: 0,
    page: true,
  },
  {
    name: "side: en id i en kommentar teller ikke",
    html: `<!-- <p id="hjelp"></p> --><label class="fs-label" for="hjelp">A</label><input class="fs-input" id="a">`,
    count: 2,
    page: true,
    mentions: ["«hjelp»"],
  },
  {
    name: "side: en ledetekst uten for inni <fs-suggestion> meldes, for malen skal skrive den",
    html: `<fs-suggestion><label class="fs-label">Kommune</label><input class="fs-input" type="text"></fs-suggestion>`,
    count: 1,
    page: true,
    mentions: ["Ledeteksten er ikke koblet"],
  },
  {
    name: "side: en hjelpetekst inni <fs-suggestion> må kobles",
    html: `<fs-suggestion><label class="fs-label" for="k">Kommune</label><input class="fs-input" type="text" id="k"><p class="fs-help-text">Hjelp</p></fs-suggestion>`,
    count: 1,
    page: true,
    mentions: ["Hjelpeteksten"],
  },
  {
    name: "side: id-er i en shadow root har sitt eget rom",
    html: `${LABELLED}<div><template shadowrootmode="open"><label class="fs-label" for="epost">E-post</label><input class="fs-input" id="epost"></template></div>`,
    count: 0,
    page: true,
  },
  {
    name: "side: markup i en attributtverdi er tekst, ikke elementer",
    html: `${LABELLED}<button class="fs-button" data-code='<fs-modal open><input class="fs-input" id="epost">'>Kopier</button>`,
    count: 0,
    page: true,
  },
  {
    name: "side: en verdi som slutter på = sluker ikke resten av siden",
    html: `<img src="data:image/png;base64,iVBORw0KGgo=" alt="">${LABELLED}`,
    count: 0,
    page: true,
  },
  {
    name: "side: et felt etter en verdi som slutter på = sjekkes fortsatt",
    html: `<a href="/s" title="1+1=">x</a><input class="fs-input" id="q">`,
    count: 1,
    page: true,
    mentions: ["<input> har ingen ledetekst"],
  },
  {
    name: "side: for som peker på en <div>",
    html: `<label class="fs-label" for="boks">Navn</label><div id="boks"></div><input class="fs-input" aria-label="Navn">`,
    count: 1,
    page: true,
    severity: "error",
    mentions: ["<div>", "ikke kan ha en ledetekst"],
    covers: "boks",
  },
  {
    name: "side: en lenke i feiloppsummeringen til et felt som ikke finnes",
    html: `${LABELLED}<fs-error-summary><h2>Rett feilene</h2><ul><li><a href="#e-post">E-post</a></li></ul></fs-error-summary>`,
    count: 1,
    page: true,
    severity: "error",
    mentions: ["feiloppsummeringen", "«#e-post»"],
    covers: "e-post",
  },
  {
    name: "side: en lenke i feiloppsummeringen til et felt som finnes",
    html: `${LABELLED}<fs-error-summary><h2>Rett feilene</h2><ul><li><a href="#epost">E-post</a></li></ul></fs-error-summary>`,
    count: 0,
    page: true,
  },
  {
    name: "side: en hjelpetekst i en skjult forelder eller lukket dialog",
    html: `<div hidden><p class="fs-help-text">A</p></div><dialog><p class="fs-error-text">B</p></dialog>`,
    count: 0,
    page: true,
  },
  {
    name: "side: en hjelpetekst i en åpen dialog sjekkes",
    html: `<dialog open><p class="fs-help-text">A</p></dialog>`,
    count: 1,
    page: true,
    mentions: ["Hjelpeteksten"],
  },
  {
    name: "side: en hjelpetekst som er et statusfelt, trenger ingen kobling",
    html: `<p class="fs-help-text" role="status"></p><p class="fs-error-text" aria-live="assertive"></p>`,
    count: 0,
    page: true,
  },
  {
    name: "side: entiteter dekodes før id-ene sammenlignes",
    html: `<label class="fs-label" for="c&#46;d">C</label><input class="fs-input" id="c.d">`,
    count: 0,
    page: true,
  },
  {
    name: "side: markup i en <textarea> er tekst",
    html: `${LABELLED}<label class="fs-label" for="t">T</label><textarea class="fs-textarea" id="t"><input class="fs-input" id="epost"></textarea>`,
    count: 0,
    page: true,
  },
  {
    name: "side: en <textarea> i en attributtverdi sluker ikke siden",
    html: `<button class="fs-button" data-code="<textarea>">Kopier</button><label class="fs-label" for="borte">X</label><label class="fs-label" for="t">T</label><textarea class="fs-textarea" id="t"></textarea>`,
    count: 1,
    page: true,
    mentions: ["«borte»"],
  },
  {
    name: "side: en <template> i en attributtverdi sluker ikke siden",
    html: `<button class="fs-button" data-code='<template>'>Kopier</button><label class="fs-label" for="borte">X</label><p>tekst</p><template></template>`,
    count: 1,
    page: true,
    mentions: ["«borte»"],
  },
  {
    name: "side: en kommentar i en attributtverdi sluker ikke siden",
    html: `<button class="fs-button" data-code="<!--">Kopier</button><label class="fs-label" for="borte">X</label><!-- slutt -->`,
    count: 1,
    page: true,
    mentions: ["«borte»"],
  },
  {
    name: "side: en tallentitet utenfor Unicode krasjer ikke",
    html: `<p id="&#99999999;">A</p><p id="&#x110000;">B</p>`,
    count: 0,
    page: true,
  },
  {
    name: "side: en prosentkodet lenke i feiloppsummeringen",
    html: `<label class="fs-label" for="fødselsdato">F</label><input class="fs-input" id="fødselsdato"><fs-error-summary><h2>Feil</h2><ul><li><a href="#f%C3%B8dselsdato">Dato</a></li></ul></fs-error-summary>`,
    count: 0,
    page: true,
  },
  {
    name: "side: en id som er en del av en annen id, teller for seg",
    html: `${LABELLED.replace('aria-describedby="epost-help"', 'aria-describedby="epost-help epost"')}`,
    count: 0,
    page: true,
  },
  {
    name: "side: funnet peker på den id-en som mangler",
    html: `<input class="fs-input" aria-label="A" aria-describedby="x-help x"><p id="x-help">H</p>`,
    count: 1,
    page: true,
    covers: "x",
    // Den andre `x`-en i verdien, ikke den første bokstaven i `x-help`.
    coversAt: '<input class="fs-input" aria-label="A" aria-describedby="x-help '
      .length,
  },
  {
    name: "side: <label/> åpner et element i HTML",
    html: `<label class="fs-label"/>Navn <input class="fs-input"></label>`,
    count: 0,
    page: true,
  },
  {
    name: "side: en / til slutt i en verdi uten anførselstegn hører til verdien",
    html: `<label class="fs-label" for=a/>A</label><input class="fs-input" id="a/">`,
    count: 0,
    page: true,
  },
  {
    name: "mal: markup i en attributtverdi leses som før uten --rendret",
    html: `<button class="fs-button" data-code="<fs-modal>">Kopier</button>`,
    count: 1,
    mentions: ["fs-modal"],
  },
  {
    name: "mal: en id som peker ut av fila meldes ikke uten --rendret",
    html: `<label class="fs-label" for="e-post">E-post</label><input class="fs-input" id="epost">`,
    count: 0,
  },
)

// Snippetene fra komponentsidene skal være rene, også som hele sider: de
// skal kunne limes inn og virke, koblingen medregnet.
/**
 * Snippeten slik den står i dokumentet etter at brukeren har godtatt
 * tabbestoppene: `${1:navn}` blir `navn`, og `$1` det samme, slik VS Code
 * speiler dem. Rømmingen tas bort til slutt.
 */
function utenTabbestopp(body: string[]): string {
  const text = body.join("\n")
  const defaults = new Map<string, string>()
  for (const m of text.matchAll(/\$\{(\d+):([^}]*)\}/g))
    defaults.set(m[1], m[2])
  return text
    .replace(/\$\{(\d+):([^}]*)\}/g, (_, _n, value: string) => value)
    .replace(/(?<!\\)\$(\d+)\b/g, (_, n: string) => defaults.get(n) ?? "")
    .replace(/\\\$/g, "$")
    .replace(/\\\\/g, "\\")
}

for (const [tag, snippet] of Object.entries(snippets()))
  for (const page of [false, true])
    cases.push({
      name: `snippeten for <${tag}>${page ? " som hel side" : ""}`,
      html: utenTabbestopp(snippet.body),
      count: 0,
      page,
    })

const started = performance.now()

// Koblingen malen må skrive selv, så feltet virker uten JavaScript og
// overlever en oppdatering fra serveren (plan v6, PR 3).
const TABS = (
  rad: string,
  paneler = `<section class="fs-tabs__panel" id="soknaden"><h2>Søknaden</h2></section><section class="fs-tabs__panel" id="vedlegg"><h2>Vedlegg</h2></section>`,
) => `<fs-tabs>${rad}${paneler}</fs-tabs>`
const RAD = `<ul class="fs-tabs__list" aria-label="Deler av saken"><li><a href="#soknaden">Søknaden</a></li><li><a href="#vedlegg">Vedlegg</a></li></ul>`
cases.push(
  {
    name: "en ledetekst uten for ved siden av et felt uten id",
    html: `<fs-field><label class="fs-label">Kommune</label><input class="fs-input" name="kommune"></fs-field>`,
    count: 1,
    mentions: ["Ledeteksten er ikke koblet til <input>", "for på ledeteksten"],
    severity: "warning",
    covers: "input",
    fixTitle: "Gi feltet id «kommune»",
    fixed: `<fs-field><label for="kommune" class="fs-label">Kommune</label><input id="kommune" class="fs-input" name="kommune"></fs-field>`,
    fixPreferred: true,
  },
  {
    name: "en ledetekst som peker på en annen id enn feltets",
    html: `<fs-field><label class="fs-label" for="annen">Kommune</label><input class="fs-input" id="kommune" name="kommune"></fs-field>`,
    count: 1,
    mentions: ["Ledeteksten er ikke koblet"],
    noFix: true,
  },
  {
    name: "et name som ikke kan bli en id gir ingen rettelse",
    html: `<fs-field><label class="fs-label">E-post</label><input class="fs-input" name="items[0].email"></fs-field>`,
    count: 1,
    noFix: true,
  },
  {
    name: "et name som alt er en id på siden gir ingen rettelse",
    html: `<p id="kommune"></p><fs-field><label class="fs-label">Kommune</label><input class="fs-input" name="kommune"></fs-field>`,
    count: 1,
    noFix: true,
  },
  {
    name: "et felt med for og id er koblet",
    html: `<fs-field><label class="fs-label" for="kommune">Kommune</label><input class="fs-input" id="kommune" name="kommune"></fs-field>`,
    count: 0,
  },
  {
    name: "en ledetekst rundt feltet er koblet",
    html: `<fs-field><label class="fs-label">Kommune <input class="fs-input" name="kommune"></label></fs-field>`,
    count: 0,
  },
  {
    name: "et felt med aria-label trenger ingen kobling",
    html: `<fs-field><label class="fs-label">Søk</label><input class="fs-input" name="q" aria-label="Søk i saken"></fs-field>`,
    count: 0,
  },
  {
    name: "en bundet id er serverens sak",
    html: `<fs-field><label class="fs-label" :for="id">Kommune</label><input class="fs-input" :id="id" name="kommune"></fs-field>`,
    count: 0,
  },
  {
    name: "en id med malsyntaks er serverens sak",
    html: `<fs-field><label class="fs-label" for="{{ .Id }}">Kommune</label><input class="fs-input" id="{{ .Id }}" name="kommune"></fs-field>`,
    count: 0,
  },
  {
    name: "asp-for gir id i Razor",
    html: `<fs-field><label class="fs-label" asp-for="Kommune">Kommune</label><input class="fs-input" asp-for="Kommune"></fs-field>`,
    count: 0,
  },
  {
    name: "forslagsfeltet med ledetekst uten for",
    html: `<fs-suggestion><label class="fs-label">Sted</label><input class="fs-input" id="sted" name="sted"><ul class="fs-suggestion__list"><li>Bergen</li></ul><span class="fs-sr-only" role="status"></span></fs-suggestion>`,
    count: 1,
    mentions: ["Ledeteksten er ikke koblet"],
    noFix: true,
  },
  {
    name: "forslagsfeltet uten ledetekst i det hele tatt",
    html: `<fs-suggestion><input class="fs-input" name="sted"><ul class="fs-suggestion__list"><li>Bergen</li></ul><span class="fs-sr-only" role="status"></span></fs-suggestion>`,
    count: 1,
    mentions: ["ingen ledetekst koblet til seg"],
    noFix: true,
  },
  {
    name: "et panel i sprettoppvinduet uten id",
    html: `<fs-popover><button class="fs-button" type="button">Meny</button><div class="fs-popover" popover>Innhold</div></fs-popover>`,
    count: 1,
    mentions: ["«panel» uten id", "popovertarget"],
    covers: "div",
    noFix: true,
  },
  {
    name: "et panel med id",
    html: `<fs-popover><button class="fs-button" type="button" popovertarget="meny">Meny</button><div class="fs-popover" popover id="meny">Innhold</div></fs-popover>`,
    count: 0,
  },
  {
    name: "et panel med bundet id",
    html: `<fs-popover><button class="fs-button" type="button">Meny</button><div class="fs-popover" popover :id="id">Innhold</div></fs-popover>`,
    count: 0,
  },
  {
    name: "en fane som peker på et panel som ikke finnes",
    html: TABS(
      RAD,
      `<section class="fs-tabs__panel" id="soknaden"><h2>Søknaden</h2></section>`,
    ),
    count: 1,
    mentions: ["#vedlegg", "ingen element har den id-en"],
    covers: "a",
  },
  {
    name: "et panel utenfor raden teller",
    html: `${TABS(RAD, `<section class="fs-tabs__panel" id="soknaden"><h2>Søknaden</h2></section>`)}<section class="fs-tabs__panel" id="vedlegg"><h2>Vedlegg</h2></section>`,
    count: 0,
  },
  {
    name: "en lenke med malsyntaks i href er serverens sak",
    html: TABS(
      `<ul class="fs-tabs__list" aria-label="Deler"><li><a href="#{{ .Id }}">Søknaden</a></li></ul>`,
      `<section class="fs-tabs__panel" id="{{ .Id }}"></section>`,
    ),
    count: 0,
  },
  {
    name: "en knapp med role=tab i raden",
    html: TABS(
      `<ul class="fs-tabs__list" aria-label="Deler av saken"><li><a href="#soknaden">Søknaden</a></li><li><button type="button" role="tab">Vedlegg</button></li></ul>`,
    ),
    count: 1,
    mentions: ['role="tab" står på <button>', "Fanene er lenker"],
    covers: "button",
  },
  {
    name: "en lenke med role=tab er en fane",
    html: TABS(
      `<ul class="fs-tabs__list" aria-label="Deler av saken" role="tablist"><li role="presentation"><a href="#soknaden" role="tab">Søknaden</a></li><li role="presentation"><a href="#vedlegg" role="tab">Vedlegg</a></li></ul>`,
    ),
    count: 0,
  },
  {
    name: "en fanerad uten navn",
    html: TABS(
      `<ul class="fs-tabs__list"><li><a href="#soknaden">Søknaden</a></li><li><a href="#vedlegg">Vedlegg</a></li></ul>`,
    ),
    count: 1,
    mentions: ["fanerad uten navn", "«faneliste»"],
    covers: "ul",
    fixTitle: "Gi raden et navn med aria-label",
    fixed: TABS(
      `<ul aria-label="Deler av saken" class="fs-tabs__list"><li><a href="#soknaden">Søknaden</a></li><li><a href="#vedlegg">Vedlegg</a></li></ul>`,
    ),
  },
  {
    name: "en fanerad med aria-labelledby",
    html: `<h2 id="deler">Deler av saken</h2>${TABS(`<ul class="fs-tabs__list" aria-labelledby="deler"><li><a href="#soknaden">Søknaden</a></li><li><a href="#vedlegg">Vedlegg</a></li></ul>`)}`,
    count: 0,
  },
  {
    name: "en fanerad med bundet aria-label",
    html: TABS(
      `<ul class="fs-tabs__list" :aria-label="navn"><li><a href="#soknaden">Søknaden</a></li><li><a href="#vedlegg">Vedlegg</a></li></ul>`,
    ),
    count: 0,
  },
  {
    name: "hjelpeteksten inni ledeteksten",
    html: `<fs-field><label class="fs-label" for="epost">E-post <span class="fs-help-text">Vi sender aldri reklame.</span></label><input class="fs-input" id="epost" name="epost"></fs-field>`,
    count: 1,
    mentions: ["Hjelpeteksten står inni <label>", "del av feltets navn"],
    covers: "span",
  },
  {
    name: "feilmeldingen inni ledeteksten",
    html: `<fs-field><label class="fs-label" for="epost">E-post <span class="fs-error-text">Skriv en e-postadresse.</span></label><input class="fs-input" id="epost" name="epost"></fs-field>`,
    count: 1,
    mentions: ["Feilmeldingen står inni <label>"],
  },
  {
    name: "hjelpeteksten ved siden av ledeteksten",
    html: `<fs-field><label class="fs-label" for="epost">E-post</label><input class="fs-input" id="epost" name="epost"><p class="fs-help-text">Vi sender aldri reklame.</p></fs-field>`,
    count: 0,
  },
  {
    name: "alternativer med data-value uten verdifelt",
    html: `<fs-suggestion><label class="fs-label" for="k">Kommune</label><input class="fs-input" id="k" name="k"><ul class="fs-suggestion__list"><li data-value="4601">Bergen</li></ul><span class="fs-sr-only" role="status"></span></fs-suggestion>`,
    count: 1,
    mentions: ["data-value, men ikke noe .fs-suggestion__value"],
    covers: "li",
  },
  {
    name: "et verdifelt uten alternativer med data-value",
    html: `<fs-suggestion><label class="fs-label" for="k">Kommune</label><input class="fs-input" id="k" name="k"><input type="hidden" class="fs-suggestion__value" name="nr"><ul class="fs-suggestion__list"><li>Bergen</li></ul><span class="fs-sr-only" role="status"></span></fs-suggestion>`,
    count: 1,
    mentions: ["ingen alternativer med data-value"],
    covers: "input",
  },
  {
    name: "data-value og verdifelt sammen",
    html: `<fs-suggestion><label class="fs-label" for="k">Kommune</label><input class="fs-input" id="k" name="k"><input type="hidden" class="fs-suggestion__value" name="nr"><ul class="fs-suggestion__list"><li data-value="4601">Bergen</li></ul><span class="fs-sr-only" role="status"></span></fs-suggestion>`,
    count: 0,
  },
  {
    name: "en tom liste serveren fyller senere",
    html: `<fs-suggestion><label class="fs-label" for="k">Kommune</label><input class="fs-input" id="k" name="k"><input type="hidden" class="fs-suggestion__value" name="nr"><ul class="fs-suggestion__list"></ul><span class="fs-sr-only" role="status"></span></fs-suggestion>`,
    count: 0,
  },
  {
    name: "en skjult feilmelding ved siden av aria-invalid",
    html: `<fs-field><label class="fs-label" for="fnr">Fødselsnummer</label><input class="fs-input" id="fnr" name="fnr" aria-invalid="true"><p class="fs-error-text" hidden>Skriv elleve siffer.</p></fs-field>`,
    count: 1,
    mentions: ["Feilmeldingen har hidden", 'aria-invalid="true"'],
    covers: "p",
  },
  {
    name: "en skjult feilmelding på et gyldig felt",
    html: `<fs-field><label class="fs-label" for="fnr">Fødselsnummer</label><input class="fs-input" id="fnr" name="fnr"><p class="fs-error-text" hidden>Skriv elleve siffer.</p></fs-field>`,
    count: 0,
  },
  {
    name: "en feilmelding Datastar skjuler er serverens sak",
    html: `<fs-field><label class="fs-label" for="fnr">Fødselsnummer</label><input class="fs-input" id="fnr" name="fnr" aria-invalid="true"><p class="fs-error-text" data-attr:hidden="!$ugyldig">Skriv elleve siffer.</p></fs-field>`,
    count: 0,
  },
  {
    name: "invalid på fs-field, slik det ble skrevet før",
    html: `<fs-field invalid><label class="fs-label" for="fnr">Fødselsnummer</label><input class="fs-input" id="fnr" name="fnr"></fs-field>`,
    count: 1,
    mentions: ["invalid er tatt ut av <fs-field>", "aria-invalid"],
    covers: "invalid",
    fixTitle: "Ta bort invalid",
    fixed: `<fs-field><label class="fs-label" for="fnr">Fødselsnummer</label><input class="fs-input" id="fnr" name="fnr"></fs-field>`,
  },
  {
    name: "required-marker på fs-field, slik det ble skrevet før",
    html: `<fs-field required-marker="*"><label class="fs-label" for="fnr">Fødselsnummer</label><input class="fs-input" id="fnr" name="fnr"></fs-field>`,
    count: 1,
    mentions: ["data-required"],
    fixed: `<fs-field><label class="fs-label" for="fnr">Fødselsnummer</label><input class="fs-input" id="fnr" name="fnr"></fs-field>`,
  },
  {
    name: "en id komponenten lagde selv, kopiert inn i malen",
    html: `<fs-field><label class="fs-label" for="e">E-post</label><input class="fs-input" id="e" name="epost"><p class="fs-help-text" id="fs-field-help-a1b2c3d">Hjelp</p></fs-field>`,
    count: 1,
    mentions: ["kopiert fra DevTools"],
    covers: "fs-field-help-a1b2c3d",
  },
  {
    name: "en id fra createFieldId, kopiert inn i malen",
    html: `<fs-field><label class="fs-label" for="fs-field-3-k2x9qa">E-post</label><input class="fs-input" id="fs-field-3-k2x9qa" name="epost"></fs-field>`,
    count: 1,
    mentions: ["kopiert fra DevTools"],
  },
  {
    name: "den samme id-en på en rendret side er riktig",
    html: `<fs-field><label class="fs-label" for="e">E-post</label><input class="fs-input" id="e" name="epost" aria-describedby="fs-field-help-a1b2c3d"><p class="fs-help-text" id="fs-field-help-a1b2c3d">Hjelp</p></fs-field>`,
    count: 0,
    page: true,
  },
  {
    name: "en egen id som begynner med fs-",
    html: `<fs-field><label class="fs-label" for="e">E-post</label><input class="fs-input" id="e" name="epost"><p class="fs-help-text" id="fs-field-help">Hjelp</p></fs-field>`,
    count: 0,
  },
  {
    name: "et kodet fragment finner panelet sitt, som i nettleseren",
    html: TABS(
      `<ul class="fs-tabs__list" aria-label="Deler"><li><a href="#s%C3%B8knaden">Søknaden</a></li></ul>`,
      `<section class="fs-tabs__panel" id="søknaden"></section>`,
    ),
    count: 0,
  },
  {
    name: "invalid bundet i Datastar, slik den gamle oppskriften skrev det",
    html: `<fs-field data-attr:invalid="$ugyldig"><label class="fs-label" for="e">E-post</label><input class="fs-input" id="e"></fs-field>`,
    count: 1,
    mentions: ["invalid er tatt ut av <fs-field>"],
    fixTitle: "Ta bort data-attr:invalid",
    fixed: `<fs-field><label class="fs-label" for="e">E-post</label><input class="fs-input" id="e"></fs-field>`,
  },
  {
    name: "invalid bundet i Vue",
    html: `<fs-field :invalid="ugyldig"><label class="fs-label" for="e">E-post</label><input class="fs-input" id="e"></fs-field>`,
    count: 1,
    mentions: ["invalid er tatt ut av <fs-field>"],
  },
  {
    name: "id-ene forslagsfeltet lager selv, kopiert inn i malen",
    html: `<fs-suggestion><label class="fs-label" for="k">Kommune</label><input class="fs-input" id="k"><ul class="fs-suggestion__list" id="fs-suggestion-list-a1b2c3d"><li id="fs-suggestion-option-q9w8e7r">Bergen</li></ul></fs-suggestion>`,
    count: 2,
    mentions: ["kopiert fra DevTools"],
  },
  {
    name: "en bundet for på ledeteksten er serverens sak",
    html: `<fs-suggestion><label class="fs-label" :for="'k'">Kommune</label><input class="fs-input" id="k"><ul class="fs-suggestion__list"><li>Bergen</li></ul></fs-suggestion>`,
    count: 0,
  },
  {
    name: "[attr.id] og [attr.for] i Angular er serverens sak",
    html: `<fs-field><label class="fs-label" [attr.for]="id">Kommune</label><input class="fs-input" [attr.id]="id" name="kommune"></fs-field>`,
    count: 0,
  },
  {
    name: "meldingen om et panel uten id er ren tekst",
    html: `<fs-popover><button class="fs-button" type="button">Meny</button><div class="fs-popover" popover>Innhold</div></fs-popover>`,
    count: 1,
    notMentions: ["`"],
  },
  {
    name: "en vert i en løkke i malen er serverens sak",
    html: `{{ range .Felt }}<fs-field><label class="fs-label">{{ .Navn }}</label><input class="fs-input" name="{{ .Navn }}"></fs-field>{{ end }}`,
    count: 0,
  },
  {
    name: "en ledetekst med v-if er serverens sak",
    html: `<fs-field><label class="fs-label" v-if="vis">Kommune</label><input class="fs-input" name="kommune"></fs-field>`,
    count: 0,
  },
)

for (const c of cases) {
  const fail = (message: string) => findings.push(`${c.name}: ${message}`)
  let found: Finding[]
  const before = performance.now()
  try {
    found = c.page ? core.diagnosePage(c.html) : core.diagnoseMarkup(c.html)
  } catch (error) {
    fail(`kastet: ${error instanceof Error ? error.message : String(error)}`)
    continue
  }
  // Tidsgrensen er en lokal vakt for hurtigbufferen, ikke en påstand om en
  // delt CI-maskin: der kan veggklokka gi rødt uten at noe er galt.
  const took = performance.now() - before
  if (c.maxMs && took > c.maxMs && !process.env.CI)
    fail(`tok ${Math.round(took)} ms, og skal ta under ${c.maxMs}`)
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
  for (const m of c.notMentions ?? [])
    if (first.message.includes(m))
      fail(`meldingen nevner «${m}»: ${first.message}`)
  if (c.severity && first.severity !== c.severity)
    fail(`ventet ${c.severity}, fikk ${first.severity}`)
  if (c.covers) {
    const covered = c.html.slice(first.start, first.end)
    if (covered !== c.covers)
      fail(`funnet dekker «${covered}», ikke «${c.covers}»`)
  }
  if (c.coversAt !== undefined && first.start !== c.coversAt)
    fail(`funnet begynner på ${first.start}, ikke på ${c.coversAt}`)
  if (!first.link.startsWith("https://fristil.sobernetics.no/"))
    fail(`lenken peker ikke på dokumentasjonen: ${first.link}`)
  if (c.noFix && first.fix)
    fail(
      `funnet har en rettelse, «${first.fix.edits.map((e) => e.text).join("», «")}», og skulle ikke hatt det`,
    )
  if (c.fixed !== undefined || c.fixTitle || c.fixPreferred !== undefined) {
    if (!first.fix) fail("funnet har ingen rettelse")
    else {
      // Bakfra, så posisjonene i de første endringene holder.
      const applied = [...first.fix.edits]
        .sort((a, b) => b.start - a.start)
        .reduce(
          (tekst, e) => tekst.slice(0, e.start) + e.text + tekst.slice(e.end),
          c.html,
        )
      if (c.fixed !== undefined && applied !== c.fixed)
        fail(`rettelsen ga «${applied}», ikke «${c.fixed}»`)
      if (c.fixTitle && first.fix.title !== c.fixTitle)
        fail(`rettelsen heter «${first.fix.title}», ikke «${c.fixTitle}»`)
      const preferred = first.fix.preferred ?? false
      if (c.fixPreferred !== undefined && preferred !== c.fixPreferred)
        fail(
          `rettelsen er ${preferred ? "" : "ikke "}foretrukket, og skulle ${c.fixPreferred ? "" : "ikke "}vært det`,
        )
    }
  }
}

const elapsed = performance.now() - started
if (elapsed > 2000)
  findings.push(
    `alle tilfellene tok ${Math.round(elapsed)} ms, og skal ta under 2000`,
  )

if (findings.length) {
  console.error(
    `Diagnostikken feiler på ${findings.length} punkt:\n  ${findings.join("\n  ")}`,
  )
  process.exit(1)
}
console.log(
  `Diagnostikken består ${cases.length} tilfeller, ${Object.keys(all).length} elementer og ${Object.keys(classes).length} klasser.`,
)
