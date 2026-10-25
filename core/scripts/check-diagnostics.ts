/**
 * At kjernen feller hver feiltype den skal, og bare dem.
 *
 * Kjernen er Rust-modulen slik `bun run core` sist bygget den, med
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
 * Kjør med: bun core/scripts/check-diagnostics.ts (etter bun core/scripts/build.ts)
 */

import { readFileSync } from "node:fs"
import {
  classesData,
  diagnosticsData,
  snippets,
} from "../../designsystem/scripts/generate-vocabulary"
import {
  type Finding,
  loadCore,
} from "../../designsystem/src/diagnostics/core.js"
import type {
  Classes,
  Elements,
} from "../../designsystem/src/vocabulary/types.js"
import { MODUL } from "./build.js"

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

const FIELD_OK = `<lt-field id="f"><label for="navn">Navn</label><input class="lt-input" name="navn" id="navn"></lt-field>`

const cases: Case[] = [
  {
    name: "en knapp med bare et ikon og ikke noe navn",
    html: `<button class="lt-button"><svg class="lt-icon" aria-hidden="true"><path d="M0 0"/></svg><span aria-hidden="true">x</span></button>`,
    count: 1,
    mentions: ["<button> har bare et ikon", "aria-label", "lt-sr-only"],
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
    html: `<button><svg class="lt-icon" aria-hidden="true"></svg> Slett</button>
<button aria-label="Slett"><svg class="lt-icon" aria-hidden="true"></svg></button>
<button title="Slett"><svg class="lt-icon" aria-hidden="true"></svg></button>
<button><svg class="lt-icon" aria-hidden="true"></svg><span class="lt-sr-only">Slett</span></button>
<button><img src="x.svg" alt="Slett"></button>
<button><svg><title>Slett</title></svg></button>
<a><svg class="lt-icon" aria-hidden="true"></svg></a>
<button hidden><svg class="lt-icon" aria-hidden="true"></svg></button>
<button>{{ .Navn }}<svg class="lt-icon" aria-hidden="true"></svg></button>
<button></button>`,
    count: 0,
  },
  {
    name: "et felt med to kontroller",
    html: `<lt-field><label for="a">Telefon</label><input name="a" id="a"><select name="b"></select></lt-field>`,
    count: 1,
    mentions: [
      "<lt-field> har delen «control» mer enn én gang",
      "bare den første",
    ],
    severity: "warning",
    covers: "select",
  },
  {
    name: "to hjelpetekster i et felt, der bare den første kobles",
    html: `<lt-field><label for="n">Navn</label><input name="n" id="n"><p class="lt-help-text">A</p><p class="lt-help-text">B</p></lt-field>`,
    count: 1,
    mentions: ["«help»"],
    coversAt: 90,
  },
  {
    name: "en klasse med to av en del som skal stå én gang",
    html: `<table class="lt-table"><caption>A</caption><caption>B</caption><thead></thead><tbody></tbody></table>`,
    count: 1,
    mentions: ["lt-table har delen «caption»", "skal stå én gang"],
    coversAt: 45,
  },
  {
    name: "deler som står flere ganger der det er lov, eller hører til noe annet",
    html: `<lt-popover><button>Meny</button><ul class="lt-popover" id="meny"><li><button>A</button></li><li><button>B</button></li></ul></lt-popover>
<lt-dialog><dialog><h2>Tittel</h2><div class="lt-dialog__body"><h3>Del</h3></div></dialog></lt-dialog>
<lt-field><label>A <input name="a"></label><lt-field><label>B <input name="b"></label></lt-field></lt-field>
<lt-tabs><ul class="lt-tabs__list" aria-label="Deler"><li><a href="#pa">A</a></li><li><a href="#pb">B</a></li></ul><div class="lt-tabs__panel" id="pa">A</div><div class="lt-tabs__panel" id="pb">B</div></lt-tabs>
<div class="lt-card"><h3 class="lt-card__title">A</h3><div class="lt-card"><h3 class="lt-card__title">B</h3></div></div>
<ul class="lt-list"><li>A</li><li>B</li></ul>`,
    count: 0,
  },
  {
    name: "to dialoger rett under <lt-dialog>, men ikke en nøstet",
    html: `<lt-dialog><dialog></dialog><dialog></dialog></lt-dialog>
<lt-dialog><dialog></dialog><div><dialog></dialog></div></lt-dialog>`,
    count: 1,
    mentions: ["«dialog»"],
  },
  {
    name: "en skjult verdi er ikke en kontroll til, og en delt knapp er ikke to utløsere",
    html: `<lt-field><input type="hidden" name="x"><label><input type="checkbox" name="y"> Jeg godtar</label></lt-field>
<lt-popover><button type="button">Lagre</button><button type="button" aria-controls="m">Flere valg</button><ul class="lt-popover" id="m"><li><button type="button">Lagre som</button></li></ul></lt-popover>
<fieldset class="lt-fieldset"><legend class="lt-legend">Adresse</legend><p class="lt-help-text">Der du bor</p><lt-field><label for="g">Gate</label><input name="g" id="g"><p class="lt-help-text">Med nummer</p></lt-field></fieldset>
<table class="lt-table"><caption>A</caption><thead></thead><tbody></tbody><tbody></tbody></table>`,
    count: 0,
  },
  {
    name: "en dyp nøsting og et felt med mange kontroller går fort",
    html: `<ul class="lt-list">${"<li>x".repeat(3000)}</ul><lt-field><label for="a">A</label><input name="a" id="a">${'<input name="a">'.repeat(1999)}</lt-field>`,
    count: 1999,
    maxMs: 500,
  },
  {
    name: "to deler bak et vilkår i en mal er ikke to deler",
    html: `<lt-field><label>Svar</label>{{if .Lang}}<textarea name="s"></textarea>{{else}}<input name="s">{{end}}</lt-field>`,
    count: 0,
  },
  {
    name: "en del til kan undertrykkes",
    html: `<lt-field><label for="a">A</label><input name="a" id="a"><!-- lotek-ignore-next del-flere-ganger --><input name="b"></lt-field>`,
    count: 0,
  },
  {
    name: "et element som ikke finnes",
    html: `<lt-dialog><lt-dialog-header>Tittel</lt-dialog-header></lt-dialog>`,
    count: 1,
    mentions: ["<lt-dialog-header> finnes ikke", "lt-dialog"],
    severity: "error",
    covers: "lt-dialog-header",
  },
  {
    name: "et attributt elementet ikke har",
    html: `<lt-popover placemnet="top-start"></lt-popover>`,
    count: 1,
    mentions: ["«placemnet»", "placement"],
    severity: "warning",
    covers: "placemnet",
  },
  {
    name: "globale attributter, data-, aria- og hendelser slipper gjennom",
    html: `<lt-popover id="p" class="x" data-on-click="@get('/x')" aria-label="Hjelp" onclick="1" role="dialog" hidden></lt-popover>`,
    count: 0,
  },
  {
    name: "HTMX, Alpine og Vue sine prefikser slipper gjennom",
    html: `<lt-popover hx-get="/x" x-data="{}" v-if="c"></lt-popover>`,
    count: 0,
  },
  {
    name: "Alpine, Svelte og Angular sine tegn slipper gjennom",
    html: `<lt-popover @click="a" :open="b" on:click="d" bind:open="e" [open]="f" (close)="g"></lt-popover>`,
    count: 0,
  },
  {
    name: "Angulars strukturdirektiver og i18n, og hyperscripts _, slipper gjennom",
    html: `<lt-popover *ngIf="x" i18n placement="top-start"></lt-popover><lt-dialog _="on click toggle @open"></lt-dialog>`,
    count: 0,
  },
  {
    name: "en web component som begynner på select er ingen kontroll",
    html: `<lt-field><label-x>N</label-x><select-all></select-all></lt-field>`,
    count: 1,
    mentions: ["fant ingen kontroll"],
  },
  {
    name: "Alpine i taggen gjør ikke resten til en mal",
    html: `<lt-popover @click="a" placemnet="top-start"></lt-popover>`,
    count: 1,
    mentions: ["«placemnet»"],
  },
  {
    name: "en Razor-partial inne i feltet",
    html: `<lt-field><label>Navn</label>@Html.Partial("Input")</lt-field>`,
    count: 0,
  },
  {
    name: "en verdi utenfor lista",
    html: `<lt-popover placement="midt"></lt-popover>`,
    count: 1,
    mentions: ["«midt»", "Lovlige verdier"],
    severity: "error",
    covers: "placement",
  },
  {
    name: "et listeattributt uten verdi",
    html: `<lt-popover placement></lt-popover>`,
    count: 1,
    mentions: ["Lovlige verdier"],
    severity: "error",
  },
  {
    name: "et boolsk attributt med «false»",
    html: `<lt-field disabled="false"><label>N <input></label></lt-field>`,
    count: 1,
    mentions: ["boolsk", 'disabled="false" betyr det samme som disabled'],
    severity: "warning",
  },
  {
    name: "et boolsk attributt med sitt eget navn eller tom verdi er greit",
    html: `<lt-field disabled="disabled" optional=""><label>N <input></label></lt-field>`,
    count: 0,
  },
  {
    name: "hidden=until-found er HTML",
    html: `<lt-error-summary hidden="until-found"></lt-error-summary>`,
    count: 0,
  },
  {
    name: "et tall som ikke er et tall",
    html: `<lt-toast duration="lenge"></lt-toast>`,
    count: 1,
    mentions: ["skal være et tall", "«lenge»"],
    severity: "error",
  },
  {
    name: "et tall som er et tall",
    html: `<lt-toast duration="5000"></lt-toast>`,
    count: 0,
  },
  {
    name: "et felt uten kontroll",
    html: `<lt-field><label>Navn</label><p class="lt-help-text">Hjelp</p></lt-field>`,
    count: 1,
    mentions: ["fant ingen kontroll", "<input>, <textarea> eller <select>"],
    severity: "warning",
    covers: "lt-field",
  },
  {
    name: "en skjult input er ingen kontroll, som i komponenten",
    html: `<lt-field><label>X</label><input type="hidden" name="csrf"></lt-field>`,
    count: 1,
    mentions: ["fant ingen kontroll"],
  },
  {
    name: "kontrollen etter en skjult input teller",
    html: `<lt-field><input type="hidden" name="csrf"><input aria-label="Søk"></lt-field>`,
    count: 0,
  },
  {
    name: "et felt uten ledetekst",
    html: `<lt-field><input class="lt-input"></lt-field>`,
    count: 1,
    mentions: ["fant ingen <label>", "uten navn"],
    severity: "warning",
  },
  {
    name: "et varsel om økten uten dialog, slik det ble skrevet før",
    html: `<lt-session-timeout warn-at="1500"></lt-session-timeout>`,
    count: 1,
    mentions: ["fant ingen <dialog>", "uten advarsel"],
    severity: "warning",
    covers: "lt-session-timeout",
  },
  {
    name: "et varsel om økten med dialog",
    html: `<lt-session-timeout><dialog><h2>Snart ute</h2></dialog></lt-session-timeout>`,
    count: 0,
  },
  {
    name: "et varsel om økten uten lukketagg, med en annen dialog lenger ned",
    html: `<lt-session-timeout warn-at="1500">\n<lt-dialog><dialog><h2>Annet</h2></dialog></lt-dialog>`,
    count: 0,
  },
  {
    name: "et varsel om økten der dialogen står i en partial",
    html: `<lt-session-timeout>{{ template "okt" . }}</lt-session-timeout>`,
    count: 0,
  },
  {
    name: "et tomt felt er et område serveren ikke har fylt",
    html: `<lt-field id="senere"></lt-field>`,
    count: 0,
  },
  {
    name: "ledetekst utenfor, med for",
    html: `<label for="epost">E-post</label><lt-field><input id="epost"></lt-field>`,
    count: 0,
  },
  {
    name: "ledetekst utenfor, med for uten anførselstegn",
    html: `<label for=epost>E-post</label><lt-field><input id="epost"></lt-field>`,
    count: 0,
  },
  {
    name: "en id med klammer og parenteser kaster ikke",
    html: `<label for="a[0].x(1)">X</label><lt-field><input id="a[0].x(1)"></lt-field>`,
    count: 0,
  },
  {
    name: "punktum i id-en er et punktum, ikke hva som helst",
    html: `<label for="ab">X</label><lt-field><input id="a.b"></lt-field>`,
    count: 1,
    mentions: ["fant ingen <label>"],
  },
  {
    name: "aria-label på kontrollen",
    html: `<lt-field><input aria-label="Søk"></lt-field>`,
    count: 0,
  },
  {
    name: "aria-labelledby på kontrollen",
    html: `<lt-field><input aria-labelledby="tittel"></lt-field>`,
    count: 0,
  },
  {
    name: "Go-mal i taggen",
    html: `<lt-field {{ if .Av }}disabled{{ end }}><label>N</label><input></lt-field>`,
    count: 0,
  },
  {
    name: "Jinja i taggen og i verdien",
    html: `<lt-popover {% if x %}open{% endif %} placement="{{ p }}"></lt-popover>`,
    count: 0,
  },
  {
    name: "PHP i taggen",
    html: `<lt-field <?= $av ? 'disabled' : '' ?>><label>N <input></label></lt-field>`,
    count: 0,
  },
  {
    name: "Razor i verdien",
    html: `<lt-field disabled="@Model.Disabled"><label>N <input></label></lt-field>`,
    count: 0,
  },
  {
    name: "en partial inne i feltet er ikke et felt uten kontroll",
    html: `<lt-field><label>Navn</label>{{ template "input" . }}</lt-field>`,
    count: 0,
  },
  {
    name: "et ukjent element meldes også i en mal",
    html: `<lt-feild {{ if .X }}disabled{{ end }}></lt-feild>`,
    count: 1,
    mentions: ["finnes ikke"],
  },
  {
    name: "kommentarer, skript og stilark leses ikke",
    html: `<!-- <lt-finnes-ikke> --><script>"<lt-nei>"</script><style>/* <lt-nei> */</style>${FIELD_OK}`,
    count: 0,
  },
  {
    name: "posisjonen står selv om en kommentar går over flere linjer",
    html: `<!--\n<lt-nei>\n-->\n<lt-tull></lt-tull>`,
    count: 1,
    covers: "lt-tull",
  },
  {
    name: "store bokstaver i tagg og attributt, og selvlukking",
    html: `<LT-TOAST DURATION="x"/>`,
    count: 1,
    mentions: ["skal være et tall"],
    covers: "DURATION",
  },
  {
    name: "en verdi med > i",
    html: `<lt-toast label="a > b" duration="5"></lt-toast>`,
    count: 0,
  },
  {
    name: "en verdi uten anførselstegn",
    html: `<lt-popover placement=top-start></lt-popover><lt-popover placement=topp></lt-popover>`,
    count: 1,
    mentions: ["«topp»"],
  },
  {
    name: "enkle anførselstegn",
    html: `<lt-popover placement='top-start'></lt-popover><lt-popover placement='topp'></lt-popover>`,
    count: 1,
    mentions: ["«topp»"],
  },
  {
    name: "en tagg over flere linjer",
    html: `<lt-popover\n  placement="top-start"\n  open\n></lt-popover>`,
    count: 0,
  },
  {
    name: "felt i felt",
    html: `<lt-field><label>A <input></label><lt-field><label>B <input></label></lt-field></lt-field>`,
    count: 0,
  },
  {
    name: "et felt uten lukketagg",
    html: `<lt-field><label>A <input></label>`,
    count: 0,
  },
  {
    name: "Alpine på kontrollen gjør ikke feltet til en mal",
    html: `<lt-field><input @input="x = 1"></lt-field>`,
    count: 1,
    mentions: ["fant ingen <label>"],
  },
  {
    name: "Alpine på en knapp i feltet heller",
    html: `<lt-field><label>N</label><button @click="x">Send</button></lt-field>`,
    count: 1,
    mentions: ["fant ingen kontroll"],
  },
  {
    name: "store bokstaver i felt: tomt felt er stille",
    html: `<LT-FIELD id="senere"></LT-FIELD>\n<p>tekst</p>`,
    count: 0,
  },
  {
    name: "store bokstaver i felt: uten ledetekst felles",
    html: `<LT-FIELD><INPUT></LT-FIELD>\n<label>x</label>`,
    count: 1,
    mentions: ["fant ingen <label>"],
  },
  {
    name: "en skrivefeil som ligner et kjent attributt",
    html: `<lt-connection-status onlinetext="Tilkoblet"></lt-connection-status>`,
    count: 1,
    mentions: ["Mente du online-text?"],
    covers: "onlinetext",
  },
  {
    name: "en skrivefeil uten bindestrek",
    html: `<lt-field describedBy="vilkar"><label>N <input></label></lt-field>`,
    count: 1,
    mentions: ["Mente du described-by?"],
  },
  {
    name: "en uavsluttet kontroll leser ikke resten som sine attributter",
    html: `<lt-field><input placeholder=it's><span aria-label="x"></span></lt-field>`,
    count: 1,
    mentions: ["fant ingen"],
  },
  {
    name: "tall slik komponentene leser dem",
    html: `<lt-toast duration=" 5000 "></lt-toast><lt-toast duration="1e3"></lt-toast><lt-toast duration=""></lt-toast>`,
    count: 1,
    mentions: ["skal være et tall"],
  },
  {
    name: "en Jinja-kommentar i taggen",
    html: `<lt-popover {# note #} placement="top-start"></lt-popover>`,
    count: 0,
  },
  {
    name: "PHP i taggen avslutter den ikke, og feilen etter felles",
    html: `<lt-popover <?= $x ?> placement="midt"></lt-popover>`,
    count: 1,
    mentions: ["«midt»"],
  },
  {
    name: "en klasse som ikke finnes, med forslag og rettelse",
    html: `<button class="lt-buton">Send</button>`,
    count: 1,
    mentions: ["«lt-buton» finnes ikke", "Mente du lt-button?"],
    severity: "warning",
    covers: "lt-buton",
    fixed: `<button class="lt-button">Send</button>`,
    fixTitle: "Bytt til lt-button",
  },
  {
    name: "en klasse langt fra alle kjente får ikke forslag",
    html: `<button class="lt-knapp">Send</button>`,
    count: 1,
    mentions: ["«lt-knapp» finnes ikke"],
    notMentions: ["Mente du"],
  },
  {
    name: "en ren verdi i en tagg med mal sjekkes likevel",
    html: `<button class="lt-button" {{ if .X }}disabled{{ end }} data-variant="ghots"></button>`,
    count: 1,
    mentions: ["«ghots»"],
  },
  {
    name: "en klasse med mal i navnet er ingen skrivefeil",
    html: `<div class="lt-{{ .Type }} kort"></div><div class="lt-<?= $x ?>"></div>`,
    count: 0,
  },
  {
    name: "kjente klasser, også flere i samme attributt og med mal",
    html: `<input class="lt-input lt-search" type="search"><div class="{{ .Klasse }} lt-card"></div><p class="kort lt-paragraph"></p>`,
    count: 0,
  },
  {
    name: "en variant utenfor lista, med forslag og rettelse",
    html: `<button class="lt-button" data-variant="ghots">Send</button>`,
    count: 1,
    mentions: [
      "data-variant kan ikke være «ghots» på button",
      "secondary, ghost, danger",
      "primary uten attributt",
    ],
    fixed: `<button class="lt-button" data-variant="ghost">Send</button>`,
    fixTitle: "Bytt til ghost",
  },
  {
    name: "lovlige varianter, standardverdien og type på input",
    html: `<button class="lt-button" data-variant="danger"></button><button class="lt-button" data-variant="primary"></button><input class="lt-input" type="email"><h2 class="lt-heading" data-size="xl"></h2>`,
    count: 0,
  },
  {
    name: "et attributt en annen klasse tar, sjekkes ikke her",
    html: `<div class="lt-card" data-variant="ghost"></div><span class="lt-badge" data-size="xl"></span>`,
    count: 1,
    mentions: ["data-variant kan ikke være «ghost» på card"],
  },
  {
    name: "variantverdi fra en mal sjekkes ikke",
    html: `<button class="lt-button" data-variant="{{ .Variant }}"></button><button class="lt-button" data-variant="@Model.V"></button>`,
    count: 0,
  },
  {
    name: "rettelsen for et attributtnavn",
    html: `<lt-connection-status onlinetext="Tilkoblet"></lt-connection-status>`,
    count: 1,
    fixed: `<lt-connection-status online-text="Tilkoblet"></lt-connection-status>`,
    fixTitle: "Bytt til online-text",
  },
  {
    name: "rettelsen for et boolsk attributt tar med verdien og mellomrommet",
    html: `<lt-field disabled="false" id="x"><label>N <input></label></lt-field>`,
    count: 1,
    fixed: `<lt-field id="x"><label>N <input></label></lt-field>`,
    fixTitle: "Ta bort disabled",
    fixPreferred: true,
  },
  {
    name: "rettelsen for et boolsk attributt sist i taggen",
    html: `<lt-field id="x" disabled="false"><label>N <input></label></lt-field>`,
    count: 1,
    fixed: `<lt-field id="x"><label>N <input></label></lt-field>`,
  },
  {
    name: "rettelsen for et felt uten ledetekst",
    html: `<lt-field><input class="lt-input" id="navn"></lt-field>`,
    count: 1,
    fixed: `<lt-field><label for="navn">Ledetekst</label><input class="lt-input" id="navn"></lt-field>`,
    fixTitle: "Sett inn en ledetekst",
  },
  {
    // En `<label>` uten `for` ved siden av feltet er ikke koblet til det.
    // Uten id finnes ingen rettelse som er én innsetting.
    name: "et felt uten ledetekst og uten id får ingen rettelse",
    html: `<lt-field><input class="lt-input"></lt-field>`,
    count: 1,
    mentions: ["legg <label> rundt feltet"],
    noFix: true,
  },
  {
    name: "ledeteksten får sin egen linje med samme innrykk",
    html: `<lt-field>\n  <input class="lt-input" id="navn">\n</lt-field>`,
    count: 1,
    fixed: `<lt-field>\n  <label for="navn">Ledetekst</label>\n  <input class="lt-input" id="navn">\n</lt-field>`,
  },
  {
    name: "ledeteksten får sin egen linje også med \\r-linjeskift",
    html: `<lt-field>\r  <input class="lt-input" id="navn">\r</lt-field>`,
    count: 1,
    fixed: `<lt-field>\r  <label for="navn">Ledetekst</label>\r  <input class="lt-input" id="navn">\r</lt-field>`,
  },
  {
    name: "data-required på ledetekst og legend",
    html: `<label class="lt-label" data-required="stjerne">N</label><legend class="lt-legend" data-required="text">G</legend>`,
    count: 1,
    mentions: ["data-required kan ikke være «stjerne»", "symbol, text"],
  },
  {
    name: "data-variant på input, som CSS-en leser",
    html: `<input class="lt-input" data-variant="dato" type="date"><input class="lt-input" data-variant="date" type="date">`,
    count: 1,
    mentions: [
      "data-variant kan ikke være «dato»",
      "date, datetime-local, time",
    ],
    fixed: `<input class="lt-input" data-variant="date" type="date"><input class="lt-input" data-variant="date" type="date">`,
  },
  {
    name: "type på input er HTML sitt eget, og sjekkes ikke, heller ikke hidden",
    html: `<input class="lt-input" type="color"><input class="lt-input" type="hidden"><input class="lt-input" type="file">`,
    count: 0,
  },
  {
    name: "et kort navn får ikke forslag to tegn unna",
    html: `<div class="lt-tabs"></div>`,
    count: 1,
    notMentions: ["Mente du"],
  },
  {
    name: "en byttet plass er én feil, og forslaget er ikke foretrukket",
    html: `<button class="lt-button" data-variant="ghots"></button>`,
    count: 1,
    fixTitle: "Bytt til ghost",
    fixPreferred: false,
  },
  {
    name: "samme bokstaver er den sikre rettelsen",
    html: `<lt-connection-status onlinetext="x"></lt-connection-status>`,
    count: 1,
    mentions: ["Mente du online-text"],
    fixPreferred: true,
  },
  {
    name: "et langt navn får to tegns slingring",
    html: `<p class="lt-eror-txt"></p>`,
    count: 1,
    mentions: ["Mente du lt-error-text?"],
  },
  {
    name: "lengdefilteret slipper gjennom akkurat på grensen",
    html: `<a class="lt-lin"></a>`,
    count: 1,
    mentions: ["Mente du lt-link?"],
  },
  {
    name: "ved lik avstand vinner den som deler begynnelsen",
    html: `<table class="lt-tabel"></table>`,
    count: 1,
    mentions: ["Mente du lt-table?"],
  },
  {
    name: "«Ta bort» over flere linjer",
    html: `<lt-field\n  disabled="false"\n  id="x"><label>N <input></label></lt-field>`,
    count: 1,
    fixed: `<lt-field\n  id="x"><label>N <input></label></lt-field>`,
  },
  {
    name: "rettelse på en klasse uten anførselstegn",
    html: `<p class=lt-buton></p>`,
    count: 1,
    fixed: `<p class=lt-button></p>`,
  },
  {
    name: "rettelse på en verdi uten anførselstegn",
    html: `<button class=lt-button data-variant=ghots></button>`,
    count: 1,
    fixed: `<button class=lt-button data-variant=ghost></button>`,
  },
  {
    name: "to klasser som tar samme attributt gir ett funn",
    html: `<input class="lt-input lt-search" data-state="ugyldig">`,
    count: 1,
  },
  {
    name: "Astro og Svelte: en verdi i klammer er et uttrykk",
    html: `<lt-popover placement={placement} open={isOpen}></lt-popover><lt-toast duration={ms}></lt-toast><button class="lt-button" data-variant={v}></button>`,
    count: 0,
  },
  {
    name: "Astro og Svelte: klammer med anførselstegn og nøsting inni",
    html: `<input class="lt-input" data-state={feil ? "invalid" : undefined}><lt-field class:list={["lt-card", { kort }]}></lt-field>`,
    count: 0,
  },
  {
    name: "en klamme inne i et anførselstegn i uttrykket avslutter det ikke",
    html: `<lt-popover placement={a ? "}" : "x"} open></lt-popover>`,
    count: 0,
  },
  {
    name: "klammer i klammer, og feilen etter dem felles fortsatt",
    html: `<lt-popover placement={c ? {a:1}.p : "top-start"} plasement="x"></lt-popover>`,
    count: 1,
    mentions: ["«plasement»"],
  },
  {
    name: "Svelte: en klasse med et uttrykk i sjekkes ikke, de andre gjør",
    html: `<div class="lt-card lt-{b} lt-buton"></div>`,
    count: 1,
    mentions: ["«lt-buton»"],
  },
  {
    name: "klammeverdi og så en ekte feil etter",
    html: `<lt-popover open={isOpen} placemnet="top-start"></lt-popover>`,
    count: 1,
    mentions: ["«placemnet»"],
    covers: "placemnet",
  },
  {
    name: "en tom verdi er ingen verdi",
    html: `<button class="lt-button" data-variant=""></button>`,
    count: 0,
  },
  {
    name: "samme bokstaver i en klasse er den sikre rettelsen",
    html: `<p class="lt-error_text"></p>`,
    count: 1,
    fixTitle: "Bytt til lt-error-text",
    fixPreferred: true,
  },
  {
    name: "samme ukjente klasse mange ganger går fort",
    html: Array.from(
      { length: 3000 },
      () => `<td class="lt-cell lt-celle">x</td>`,
    ).join("\n"),
    count: 6000,
    maxMs: 60,
  },
  {
    name: "funnene kommer i tekstens rekkefølge",
    html: `<lt-popover placemnet="x"></lt-popover><button class="lt-buton"></button><lt-tull></lt-tull>`,
    count: 3,
    mentions: ["placemnet"],
  },
  {
    name: "flere funn i samme tagg meldes hver for seg",
    html: `<lt-popover placemnet="top-start" open="false"></lt-popover>`,
    count: 2,
  },
  {
    name: "en ren fil",
    html: `<!doctype html><html><body>${FIELD_OK}<lt-popover placement="top-start" open></lt-popover></body></html>`,
    count: 0,
  },
]

// Koblingen på en hel side, med `--rendret` eller en adresse.
const LABELLED = `<label class="lt-label" for="epost">E-post</label><input class="lt-input" id="epost" aria-describedby="epost-help"><p class="lt-help-text" id="epost-help">Hjelp</p>`
cases.push(
  {
    name: "side: et rent felt med ledetekst og hjelpetekst",
    html: LABELLED,
    count: 0,
    page: true,
  },
  {
    name: "side: for peker på en id som ikke finnes",
    html: `<label class="lt-label" for="e-post">E-post</label><input class="lt-input" id="epost">`,
    count: 2,
    page: true,
    severity: "error",
    mentions: ["for=", "«e-post»", "ledeteksten", "lt.field({ id })"],
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
    html: `<input class="lt-input" id="sok" aria-labelledby="sok-tittel">`,
    count: 1,
    page: true,
    mentions: ["aria-labelledby", "navnet"],
  },
  {
    name: "side: aria-controls får ingen oppskrift om feltet",
    html: `<button class="lt-button" aria-controls="meny">Meny</button>`,
    count: 1,
    page: true,
    mentions: ["aria-controls", "«meny»"],
    notMentions: ["lt.field("],
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
    name: "side: et LO-TEK-felt uten ledetekst",
    html: `<label class="lt-label">Navn</label><input class="lt-input" id="navn">`,
    count: 1,
    page: true,
    severity: "warning",
    mentions: ["<input> har ingen ledetekst", "lt.field({ id })"],
    covers: "input",
  },
  {
    name: "side: et felt med <label> rundt har ledetekst",
    html: `<label class="lt-label">Navn <input class="lt-input"></label>`,
    count: 0,
    page: true,
  },
  {
    name: "side: et felt med aria-label har ledetekst",
    html: `<input class="lt-input lt-search" type="search" aria-label="Søk">`,
    count: 0,
    page: true,
  },
  {
    name: "side: et skjult felt og en sendeknapp trenger ingen ledetekst",
    html: `<input class="lt-input" type="hidden" name="t"><input class="lt-button" type="submit" value="Send">`,
    count: 0,
    page: true,
  },
  {
    name: "side: bar markup inni <lt-field> er riktig",
    html: `<lt-field><label class="lt-label" for="navn">Navn</label><input class="lt-input" id="navn"><p class="lt-help-text">Hjelp</p><p class="lt-error-text" hidden>Feil</p></lt-field>`,
    count: 0,
    page: true,
  },
  {
    name: "side: en id som peker feil inni <lt-field>, meldes likevel, og ledeteksten er da ikke koblet",
    html: `<lt-field><label class="lt-label" for="x">Navn</label><input class="lt-input" id="y"></lt-field>`,
    count: 2,
    page: true,
    mentions: ["«x»"],
  },
  {
    name: "side: en hjelpetekst uten id",
    html: `<label class="lt-label" for="a">A</label><input class="lt-input" id="a"><p class="lt-help-text">Hjelp</p>`,
    count: 1,
    page: true,
    severity: "warning",
    mentions: ["Hjelpeteksten", "har ingen id"],
  },
  {
    name: "side: en synlig feilmelding som ingen peker på",
    html: `<label class="lt-label" for="a">A</label><input class="lt-input" id="a"><p class="lt-error-text" id="a-feil">Feil</p>`,
    count: 1,
    page: true,
    mentions: ["Feilmeldingen", "«a-feil»"],
  },
  {
    name: "side: en skjult feilmelding trenger ingen kobling",
    html: `<label class="lt-label" for="a">A</label><input class="lt-input" id="a"><p class="lt-error-text" id="a-feil" hidden>Feil</p>`,
    count: 0,
    page: true,
  },
  {
    name: "side: en id i en kommentar teller ikke",
    html: `<!-- <p id="hjelp"></p> --><label class="lt-label" for="hjelp">A</label><input class="lt-input" id="a">`,
    count: 2,
    page: true,
    mentions: ["«hjelp»"],
  },
  {
    name: "side: en ledetekst uten for inni <lt-suggestion> meldes, for malen skal skrive den",
    html: `<lt-suggestion><label class="lt-label">Kommune</label><input class="lt-input" type="text"></lt-suggestion>`,
    count: 1,
    page: true,
    mentions: ["Ledeteksten er ikke koblet"],
  },
  {
    name: "side: en hjelpetekst inni <lt-suggestion> må kobles",
    html: `<lt-suggestion><label class="lt-label" for="k">Kommune</label><input class="lt-input" type="text" id="k"><p class="lt-help-text">Hjelp</p></lt-suggestion>`,
    count: 1,
    page: true,
    mentions: ["Hjelpeteksten"],
  },
  {
    name: "side: id-er i en shadow root har sitt eget rom",
    html: `${LABELLED}<div><template shadowrootmode="open"><label class="lt-label" for="epost">E-post</label><input class="lt-input" id="epost"></template></div>`,
    count: 0,
    page: true,
  },
  {
    name: "side: markup i en attributtverdi er tekst, ikke elementer",
    html: `${LABELLED}<button class="lt-button" data-code='<lt-modal open><input class="lt-input" id="epost">'>Kopier</button>`,
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
    html: `<a href="/s" title="1+1=">x</a><input class="lt-input" id="q">`,
    count: 1,
    page: true,
    mentions: ["<input> har ingen ledetekst"],
  },
  {
    name: "side: for som peker på en <div>",
    html: `<label class="lt-label" for="boks">Navn</label><div id="boks"></div><input class="lt-input" aria-label="Navn">`,
    count: 1,
    page: true,
    severity: "error",
    mentions: ["<div>", "ikke kan ha en ledetekst"],
    covers: "boks",
  },
  {
    name: "side: en lenke i feiloppsummeringen til et felt som ikke finnes",
    html: `${LABELLED}<lt-error-summary><h2>Rett feilene</h2><ul><li><a href="#e-post">E-post</a></li></ul></lt-error-summary>`,
    count: 1,
    page: true,
    severity: "error",
    mentions: ["feiloppsummeringen", "«#e-post»"],
    covers: "e-post",
  },
  {
    name: "side: en lenke i feiloppsummeringen til et felt som finnes",
    html: `${LABELLED}<lt-error-summary><h2>Rett feilene</h2><ul><li><a href="#epost">E-post</a></li></ul></lt-error-summary>`,
    count: 0,
    page: true,
  },
  {
    name: "side: en hjelpetekst i en skjult forelder eller lukket dialog",
    html: `<div hidden><p class="lt-help-text">A</p></div><dialog><p class="lt-error-text">B</p></dialog>`,
    count: 0,
    page: true,
  },
  {
    name: "side: en hjelpetekst i en åpen dialog sjekkes",
    html: `<dialog open><p class="lt-help-text">A</p></dialog>`,
    count: 1,
    page: true,
    mentions: ["Hjelpeteksten"],
  },
  {
    name: "side: en hjelpetekst som er et statusfelt, trenger ingen kobling",
    html: `<p class="lt-help-text" role="status"></p><p class="lt-error-text" aria-live="assertive"></p>`,
    count: 0,
    page: true,
  },
  {
    name: "side: entiteter dekodes før id-ene sammenlignes",
    html: `<label class="lt-label" for="c&#46;d">C</label><input class="lt-input" id="c.d">`,
    count: 0,
    page: true,
  },
  {
    name: "side: markup i en <textarea> er tekst",
    html: `${LABELLED}<label class="lt-label" for="t">T</label><textarea class="lt-textarea" id="t"><input class="lt-input" id="epost"></textarea>`,
    count: 0,
    page: true,
  },
  {
    name: "side: en <textarea> i en attributtverdi sluker ikke siden",
    html: `<button class="lt-button" data-code="<textarea>">Kopier</button><label class="lt-label" for="borte">X</label><label class="lt-label" for="t">T</label><textarea class="lt-textarea" id="t"></textarea>`,
    count: 1,
    page: true,
    mentions: ["«borte»"],
  },
  {
    name: "side: en <template> i en attributtverdi sluker ikke siden",
    html: `<button class="lt-button" data-code='<template>'>Kopier</button><label class="lt-label" for="borte">X</label><p>tekst</p><template></template>`,
    count: 1,
    page: true,
    mentions: ["«borte»"],
  },
  {
    name: "side: en kommentar i en attributtverdi sluker ikke siden",
    html: `<button class="lt-button" data-code="<!--">Kopier</button><label class="lt-label" for="borte">X</label><!-- slutt -->`,
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
    html: `<label class="lt-label" for="fødselsdato">F</label><input class="lt-input" id="fødselsdato"><lt-error-summary><h2>Feil</h2><ul><li><a href="#f%C3%B8dselsdato">Dato</a></li></ul></lt-error-summary>`,
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
    html: `<input class="lt-input" aria-label="A" aria-describedby="x-help x"><p id="x-help">H</p>`,
    count: 1,
    page: true,
    covers: "x",
    // Den andre `x`-en i verdien, ikke den første bokstaven i `x-help`.
    coversAt: '<input class="lt-input" aria-label="A" aria-describedby="x-help '
      .length,
  },
  {
    name: "side: <label/> åpner et element i HTML",
    html: `<label class="lt-label"/>Navn <input class="lt-input"></label>`,
    count: 0,
    page: true,
  },
  {
    name: "side: en / til slutt i en verdi uten anførselstegn hører til verdien",
    html: `<label class="lt-label" for=a/>A</label><input class="lt-input" id="a/">`,
    count: 0,
    page: true,
  },
  {
    name: "mal: markup i en attributtverdi leses som før uten --rendret",
    html: `<button class="lt-button" data-code="<lt-modal>">Kopier</button>`,
    count: 1,
    mentions: ["lt-modal"],
  },
  {
    name: "mal: en id som peker ut av fila meldes ikke uten --rendret",
    html: `<label class="lt-label" for="e-post">E-post</label><input class="lt-input" id="epost">`,
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
  paneler = `<section class="lt-tabs__panel" id="soknaden"><h2>Søknaden</h2></section><section class="lt-tabs__panel" id="vedlegg"><h2>Vedlegg</h2></section>`,
) => `<lt-tabs>${rad}${paneler}</lt-tabs>`
const RAD = `<ul class="lt-tabs__list" aria-label="Deler av saken"><li><a href="#soknaden">Søknaden</a></li><li><a href="#vedlegg">Vedlegg</a></li></ul>`
cases.push(
  {
    name: "en ledetekst uten for ved siden av et felt uten id",
    html: `<lt-field><label class="lt-label">Kommune</label><input class="lt-input" name="kommune"></lt-field>`,
    count: 1,
    mentions: ["Ledeteksten er ikke koblet til <input>", "for på ledeteksten"],
    severity: "warning",
    covers: "input",
    fixTitle: "Gi feltet id «kommune»",
    fixed: `<lt-field><label for="kommune" class="lt-label">Kommune</label><input id="kommune" class="lt-input" name="kommune"></lt-field>`,
    fixPreferred: true,
  },
  {
    name: "en ledetekst som peker på en annen id enn feltets",
    html: `<lt-field><label class="lt-label" for="annen">Kommune</label><input class="lt-input" id="kommune" name="kommune"></lt-field>`,
    count: 1,
    mentions: ["Ledeteksten er ikke koblet"],
    noFix: true,
  },
  {
    name: "et name som ikke kan bli en id gir ingen rettelse",
    html: `<lt-field><label class="lt-label">E-post</label><input class="lt-input" name="items[0].email"></lt-field>`,
    count: 1,
    noFix: true,
  },
  {
    name: "et name som alt er en id på siden gir ingen rettelse",
    html: `<p id="kommune"></p><lt-field><label class="lt-label">Kommune</label><input class="lt-input" name="kommune"></lt-field>`,
    count: 1,
    noFix: true,
  },
  {
    name: "et felt med for og id er koblet",
    html: `<lt-field><label class="lt-label" for="kommune">Kommune</label><input class="lt-input" id="kommune" name="kommune"></lt-field>`,
    count: 0,
  },
  {
    name: "en ledetekst rundt feltet er koblet",
    html: `<lt-field><label class="lt-label">Kommune <input class="lt-input" name="kommune"></label></lt-field>`,
    count: 0,
  },
  {
    name: "et felt med aria-label trenger ingen kobling",
    html: `<lt-field><label class="lt-label">Søk</label><input class="lt-input" name="q" aria-label="Søk i saken"></lt-field>`,
    count: 0,
  },
  {
    name: "en bundet id er serverens sak",
    html: `<lt-field><label class="lt-label" :for="id">Kommune</label><input class="lt-input" :id="id" name="kommune"></lt-field>`,
    count: 0,
  },
  {
    name: "en id med malsyntaks er serverens sak",
    html: `<lt-field><label class="lt-label" for="{{ .Id }}">Kommune</label><input class="lt-input" id="{{ .Id }}" name="kommune"></lt-field>`,
    count: 0,
  },
  {
    name: "asp-for gir id i Razor",
    html: `<lt-field><label class="lt-label" asp-for="Kommune">Kommune</label><input class="lt-input" asp-for="Kommune"></lt-field>`,
    count: 0,
  },
  {
    name: "forslagsfeltet med ledetekst uten for",
    html: `<lt-suggestion><label class="lt-label">Sted</label><input class="lt-input" id="sted" name="sted"><ul class="lt-suggestion__list"><li>Bergen</li></ul><span class="lt-sr-only" role="status"></span></lt-suggestion>`,
    count: 1,
    mentions: ["Ledeteksten er ikke koblet"],
    noFix: true,
  },
  {
    name: "forslagsfeltet uten ledetekst i det hele tatt",
    html: `<lt-suggestion><input class="lt-input" name="sted"><ul class="lt-suggestion__list"><li>Bergen</li></ul><span class="lt-sr-only" role="status"></span></lt-suggestion>`,
    count: 1,
    mentions: ["ingen ledetekst koblet til seg"],
    noFix: true,
  },
  {
    name: "et panel i sprettoppvinduet uten id",
    html: `<lt-popover><button class="lt-button" type="button">Meny</button><div class="lt-popover" popover>Innhold</div></lt-popover>`,
    count: 1,
    mentions: ["«panel» uten id", "aria-controls", "lager aldri en"],
    covers: "div",
    noFix: true,
  },
  {
    name: "et panel med id",
    html: `<lt-popover><button class="lt-button" type="button" popovertarget="meny">Meny</button><div class="lt-popover" popover id="meny">Innhold</div></lt-popover>`,
    count: 0,
  },
  {
    name: "et panel med bundet id",
    html: `<lt-popover><button class="lt-button" type="button">Meny</button><div class="lt-popover" popover :id="id">Innhold</div></lt-popover>`,
    count: 0,
  },
  {
    name: "en fane som peker på et panel som ikke finnes",
    html: TABS(
      RAD,
      `<section class="lt-tabs__panel" id="soknaden"><h2>Søknaden</h2></section>`,
    ),
    count: 1,
    mentions: ["#vedlegg", "ingen element har den id-en"],
    covers: "a",
  },
  {
    name: "et panel utenfor raden teller",
    html: `${TABS(RAD, `<section class="lt-tabs__panel" id="soknaden"><h2>Søknaden</h2></section>`)}<section class="lt-tabs__panel" id="vedlegg"><h2>Vedlegg</h2></section>`,
    count: 0,
  },
  {
    name: "en lenke med malsyntaks i href er serverens sak",
    html: TABS(
      `<ul class="lt-tabs__list" aria-label="Deler"><li><a href="#{{ .Id }}">Søknaden</a></li></ul>`,
      `<section class="lt-tabs__panel" id="{{ .Id }}"></section>`,
    ),
    count: 0,
  },
  {
    name: "en knapp med role=tab i raden",
    html: TABS(
      `<ul class="lt-tabs__list" aria-label="Deler av saken"><li><a href="#soknaden">Søknaden</a></li><li><button type="button" role="tab">Vedlegg</button></li></ul>`,
    ),
    count: 1,
    mentions: ['role="tab" står på <button>', "Fanene er lenker"],
    covers: "button",
  },
  {
    name: "en lenke med role=tab er en fane",
    html: TABS(
      `<ul class="lt-tabs__list" aria-label="Deler av saken" role="tablist"><li role="presentation"><a href="#soknaden" role="tab">Søknaden</a></li><li role="presentation"><a href="#vedlegg" role="tab">Vedlegg</a></li></ul>`,
    ),
    count: 0,
  },
  {
    name: "en fanerad uten navn",
    html: TABS(
      `<ul class="lt-tabs__list"><li><a href="#soknaden">Søknaden</a></li><li><a href="#vedlegg">Vedlegg</a></li></ul>`,
    ),
    count: 1,
    mentions: ["fanerad uten navn", "«faneliste»"],
    covers: "ul",
    fixTitle: "Gi raden et navn med aria-label",
    fixed: TABS(
      `<ul aria-label="Deler av saken" class="lt-tabs__list"><li><a href="#soknaden">Søknaden</a></li><li><a href="#vedlegg">Vedlegg</a></li></ul>`,
    ),
  },
  {
    name: "en fanerad med aria-labelledby",
    html: `<h2 id="deler">Deler av saken</h2>${TABS(`<ul class="lt-tabs__list" aria-labelledby="deler"><li><a href="#soknaden">Søknaden</a></li><li><a href="#vedlegg">Vedlegg</a></li></ul>`)}`,
    count: 0,
  },
  {
    name: "en fanerad med bundet aria-label",
    html: TABS(
      `<ul class="lt-tabs__list" :aria-label="navn"><li><a href="#soknaden">Søknaden</a></li><li><a href="#vedlegg">Vedlegg</a></li></ul>`,
    ),
    count: 0,
  },
  {
    name: "hjelpeteksten inni ledeteksten",
    html: `<lt-field><label class="lt-label" for="epost">E-post <span class="lt-help-text">Vi sender aldri reklame.</span></label><input class="lt-input" id="epost" name="epost"></lt-field>`,
    count: 1,
    mentions: ["Hjelpeteksten står inni <label>", "del av feltets navn"],
    covers: "span",
  },
  {
    name: "feilmeldingen inni ledeteksten",
    html: `<lt-field><label class="lt-label" for="epost">E-post <span class="lt-error-text">Skriv en e-postadresse.</span></label><input class="lt-input" id="epost" name="epost"></lt-field>`,
    count: 1,
    mentions: ["Feilmeldingen står inni <label>"],
  },
  {
    name: "hjelpeteksten ved siden av ledeteksten",
    html: `<lt-field><label class="lt-label" for="epost">E-post</label><input class="lt-input" id="epost" name="epost"><p class="lt-help-text">Vi sender aldri reklame.</p></lt-field>`,
    count: 0,
  },
  {
    name: "alternativer med data-value uten verdifelt",
    html: `<lt-suggestion><label class="lt-label" for="k">Kommune</label><input class="lt-input" id="k" name="k"><ul class="lt-suggestion__list"><li data-value="4601">Bergen</li></ul><span class="lt-sr-only" role="status"></span></lt-suggestion>`,
    count: 1,
    mentions: ["data-value, men ikke noe .lt-suggestion__value"],
    covers: "li",
  },
  {
    name: "et verdifelt uten alternativer med data-value",
    html: `<lt-suggestion><label class="lt-label" for="k">Kommune</label><input class="lt-input" id="k" name="k"><input type="hidden" class="lt-suggestion__value" name="nr"><ul class="lt-suggestion__list"><li>Bergen</li></ul><span class="lt-sr-only" role="status"></span></lt-suggestion>`,
    count: 1,
    mentions: ["ingen alternativer med data-value"],
    covers: "input",
  },
  {
    name: "data-value og verdifelt sammen",
    html: `<lt-suggestion><label class="lt-label" for="k">Kommune</label><input class="lt-input" id="k" name="k"><input type="hidden" class="lt-suggestion__value" name="nr"><ul class="lt-suggestion__list"><li data-value="4601">Bergen</li></ul><span class="lt-sr-only" role="status"></span></lt-suggestion>`,
    count: 0,
  },
  {
    name: "en tom liste serveren fyller senere",
    html: `<lt-suggestion><label class="lt-label" for="k">Kommune</label><input class="lt-input" id="k" name="k"><input type="hidden" class="lt-suggestion__value" name="nr"><ul class="lt-suggestion__list"></ul><span class="lt-sr-only" role="status"></span></lt-suggestion>`,
    count: 0,
  },
  {
    name: "en skjult feilmelding ved siden av aria-invalid",
    html: `<lt-field><label class="lt-label" for="fnr">Fødselsnummer</label><input class="lt-input" id="fnr" name="fnr" aria-invalid="true"><p class="lt-error-text" hidden>Skriv elleve siffer.</p></lt-field>`,
    count: 1,
    mentions: ["Feilmeldingen har hidden", 'aria-invalid="true"'],
    covers: "p",
  },
  {
    name: "en skjult feilmelding på et gyldig felt",
    html: `<lt-field><label class="lt-label" for="fnr">Fødselsnummer</label><input class="lt-input" id="fnr" name="fnr"><p class="lt-error-text" hidden>Skriv elleve siffer.</p></lt-field>`,
    count: 0,
  },
  {
    name: "en feilmelding Datastar skjuler er serverens sak",
    html: `<lt-field><label class="lt-label" for="fnr">Fødselsnummer</label><input class="lt-input" id="fnr" name="fnr" aria-invalid="true"><p class="lt-error-text" data-attr:hidden="!$ugyldig">Skriv elleve siffer.</p></lt-field>`,
    count: 0,
  },
  {
    name: "invalid på lt-field, slik det ble skrevet før",
    html: `<lt-field invalid><label class="lt-label" for="fnr">Fødselsnummer</label><input class="lt-input" id="fnr" name="fnr"></lt-field>`,
    count: 1,
    mentions: ["invalid er tatt ut av <lt-field>", "aria-invalid"],
    covers: "invalid",
    fixTitle: "Ta bort invalid",
    fixed: `<lt-field><label class="lt-label" for="fnr">Fødselsnummer</label><input class="lt-input" id="fnr" name="fnr"></lt-field>`,
  },
  {
    name: "required-marker på lt-field, slik det ble skrevet før",
    html: `<lt-field required-marker="*"><label class="lt-label" for="fnr">Fødselsnummer</label><input class="lt-input" id="fnr" name="fnr"></lt-field>`,
    count: 1,
    mentions: ["data-required"],
    fixed: `<lt-field><label class="lt-label" for="fnr">Fødselsnummer</label><input class="lt-input" id="fnr" name="fnr"></lt-field>`,
  },
  {
    name: "en id komponenten lagde selv, kopiert inn i malen",
    html: `<lt-field><label class="lt-label" for="e">E-post</label><input class="lt-input" id="e" name="epost"><p class="lt-help-text" id="lt-field-help-a1b2c3d">Hjelp</p></lt-field>`,
    count: 1,
    mentions: ["kopiert fra DevTools"],
    covers: "lt-field-help-a1b2c3d",
  },
  {
    name: "en id fra createFieldId, kopiert inn i malen",
    html: `<lt-field><label class="lt-label" for="lt-field-3-k2x9qa">E-post</label><input class="lt-input" id="lt-field-3-k2x9qa" name="epost"></lt-field>`,
    count: 1,
    mentions: ["kopiert fra DevTools"],
  },
  {
    name: "den samme id-en på en rendret side er riktig",
    html: `<lt-field><label class="lt-label" for="e">E-post</label><input class="lt-input" id="e" name="epost" aria-describedby="lt-field-help-a1b2c3d"><p class="lt-help-text" id="lt-field-help-a1b2c3d">Hjelp</p></lt-field>`,
    count: 0,
    page: true,
  },
  {
    name: "en egen id som begynner med lt-",
    html: `<lt-field><label class="lt-label" for="e">E-post</label><input class="lt-input" id="e" name="epost"><p class="lt-help-text" id="lt-field-help">Hjelp</p></lt-field>`,
    count: 0,
  },
  {
    name: "et kodet fragment finner panelet sitt, som i nettleseren",
    html: TABS(
      `<ul class="lt-tabs__list" aria-label="Deler"><li><a href="#s%C3%B8knaden">Søknaden</a></li></ul>`,
      `<section class="lt-tabs__panel" id="søknaden"></section>`,
    ),
    count: 0,
  },
  {
    name: "invalid bundet i Datastar, slik den gamle oppskriften skrev det",
    html: `<lt-field data-attr:invalid="$ugyldig"><label class="lt-label" for="e">E-post</label><input class="lt-input" id="e"></lt-field>`,
    count: 1,
    mentions: ["invalid er tatt ut av <lt-field>"],
    fixTitle: "Ta bort data-attr:invalid",
    fixed: `<lt-field><label class="lt-label" for="e">E-post</label><input class="lt-input" id="e"></lt-field>`,
  },
  {
    name: "invalid bundet i Vue",
    html: `<lt-field :invalid="ugyldig"><label class="lt-label" for="e">E-post</label><input class="lt-input" id="e"></lt-field>`,
    count: 1,
    mentions: ["invalid er tatt ut av <lt-field>"],
  },
  {
    name: "id-ene forslagsfeltet lager selv, kopiert inn i malen",
    html: `<lt-suggestion><label class="lt-label" for="k">Kommune</label><input class="lt-input" id="k"><ul class="lt-suggestion__list" id="lt-suggestion-list-a1b2c3d" aria-labelledby="lt-suggestion-label-z8y7x6w"><li id="lt-suggestion-option-q9w8e7r">Bergen</li></ul><span id="lt-suggestion-label-z8y7x6w"></span></lt-suggestion>`,
    count: 3,
    mentions: ["kopiert fra DevTools"],
  },
  {
    name: "en bundet for på ledeteksten er serverens sak",
    html: `<lt-suggestion><label class="lt-label" :for="'k'">Kommune</label><input class="lt-input" id="k"><ul class="lt-suggestion__list"><li>Bergen</li></ul></lt-suggestion>`,
    count: 0,
  },
  {
    name: "[attr.id] og [attr.for] i Angular er serverens sak",
    html: `<lt-field><label class="lt-label" [attr.for]="id">Kommune</label><input class="lt-input" [attr.id]="id" name="kommune"></lt-field>`,
    count: 0,
  },
  {
    name: "meldingen om et panel uten id er ren tekst",
    html: `<lt-popover><button class="lt-button" type="button">Meny</button><div class="lt-popover" popover>Innhold</div></lt-popover>`,
    count: 1,
    notMentions: ["`"],
  },
  {
    name: "en vert i en løkke i malen er serverens sak",
    html: `{{ range .Felt }}<lt-field><label class="lt-label">{{ .Navn }}</label><input class="lt-input" name="{{ .Navn }}"></lt-field>{{ end }}`,
    count: 0,
  },
  {
    name: "en ledetekst med v-if er serverens sak",
    html: `<lt-field><label class="lt-label" v-if="vis">Kommune</label><input class="lt-input" name="kommune"></lt-field>`,
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
  if (!first.link.startsWith("https://lo-tek.sobernetics.no/"))
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
