// Generert av designsystem/scripts/generate-ordforrad.ts. Ikke rediger.
import type { Elements } from "./types.js"

export const elements: Elements = {
  "fs-field": {
    "link": "https://fristil.sobernetics.no/components/field/",
    "description": "Kobler ledetekst, felt, hjelpetekst og feilmelding sammen: setter `for`, `id`, `aria-describedby` og `aria-invalid` på barna. Finnes for markup som blir til uten JavaScript. Lages markupen med JavaScript, bruk `fs.field()` i stedet.",
    "attributes": {
      "invalid": {
        "type": "flag",
        "description": "Feltet har feilet validering. Feilmeldingen vises og kontrollen får `aria-invalid`."
      },
      "disabled": {
        "type": "flag",
        "description": "Kontrollen er slått av."
      },
      "optional": {
        "type": "flag",
        "description": "Feltet er valgfritt, og ledeteksten sier det."
      },
      "required-marker": {
        "type": "values",
        "values": [
          "symbol",
          "text",
          "none"
        ],
        "description": "Hvordan ledeteksten viser at feltet er påkrevd."
      },
      "control-id": {
        "type": "text",
        "description": "Id-en kontrollen skal ha. Uten den brukes id-en som alt står på kontrollen, eller ledetekstens `for`."
      },
      "described-by": {
        "type": "text",
        "description": "Ekstra id-er som skal med i `aria-describedby`, adskilt med mellomrom."
      }
    },
    "parts": {
      "label": {
        "selector": "label",
        "description": "Ledeteksten. Står den utenfor elementet, kobles den med `for` mot kontrollens id.",
        "content": "text"
      },
      "control": {
        "selector": "input:not([type='hidden']), textarea, select",
        "description": "Kontrollen feltet kobler: et `<input>`, `<textarea>` eller `<select>`. `type=\"hidden\"` teller ikke, og bare den første får koblingen.",
        "content": "none"
      },
      "help": {
        "selector": ".fs-help-text",
        "description": "Hjelpeteksten, som leses opp sammen med kontrollen.",
        "content": "text",
        "optional": true
      },
      "error": {
        "selector": ".fs-error-text",
        "description": "Feilmeldingen, som vises og leses opp når feltet er ugyldig.",
        "content": "text",
        "optional": true
      }
    }
  },
  "fs-tabs": {
    "link": "https://fristil.sobernetics.no/components/tabs/",
    "description": "Fanerad. Gir tastatur og fokus til en `.fs-tabs__list` med knapper og ett `.fs-tabs__panel` per knapp, og setter roller, id-er og kobling der markupen kom uten. Hvilken fane som er valgt leses fra `aria-selected`, ellers fra `hidden` på panelene.",
    "attributes": {
      "server-controlled": {
        "type": "flag",
        "description": "Serveren eier tilstanden brukeren har laget: valgt fane, åpent panel, åpen liste, åpen dialog. Komponenten setter den ikke tilbake når en morfing har fjernet den."
      }
    },
    "parts": {
      "list": {
        "selector": "[role='tablist'], .fs-tabs__list",
        "description": "Raden med fanene.",
        "content": "parts"
      },
      "tab": {
        "selector": "[role='tab'], .fs-tabs__list > button:not([role])",
        "description": "En fane: en knapp i raden. Fane nummer n styrer panel nummer n.",
        "content": "text",
        "multiple": true
      },
      "panel": {
        "selector": "[role='tabpanel'], .fs-tabs__panel:not([role])",
        "description": "Innholdet til én fane, i samme rekkefølge som fanene.",
        "content": "free",
        "multiple": true
      }
    },
    "events": {
      "tab-select": {
        "detail": {
          "index": "number"
        }
      }
    }
  },
  "fs-error-summary": {
    "link": "https://fristil.sobernetics.no/components/error-summary/",
    "description": "Feiloppsummering. Flytter fokus til boksen når den kommer til syne, og til kontrollen når en lenke i lista følges.",
    "attributes": {
      "data-autofocus": {
        "type": "values",
        "values": [
          "false",
          "true"
        ],
        "description": "Om fokus flyttes til boksen når den kommer til syne. Standard er på."
      },
      "hidden": {
        "type": "flag",
        "description": "Boksen er skjult. Serveren tar attributtet bort når skjemaet feiler, og komponenten flytter fokus da."
      }
    },
    "parts": {
      "title": {
        "selector": "h1, h2, h3, h4, h5, h6",
        "description": "Overskriften i boksen. Komponenten gir den klassen for tittelen.",
        "content": "text"
      },
      "link": {
        "selector": "li a[href^='#']",
        "description": "En lenke til et felt med feil, i et listepunkt. `href` er `#` og feltets id.",
        "content": "text",
        "multiple": true
      }
    }
  },
  "fs-popover": {
    "link": "https://fristil.sobernetics.no/components/popover/",
    "description": "Panel som henger under en knapp og lukker seg selv. En knapp og et panel med klassen `fs-popover` er nok; komponenten setter `popover`, id-en og `aria-controls` der markupen kom uten.",
    "attributes": {
      "open": {
        "type": "flag",
        "description": "Panelet er åpent. Serveren kan sende attributtet for å åpne panelet."
      },
      "placement": {
        "type": "values",
        "values": [
          "bottom-start",
          "bottom-end",
          "top-start",
          "top-end"
        ],
        "description": "Hvilken kant av knappen panelet henger fra."
      },
      "server-controlled": {
        "type": "flag",
        "description": "Serveren eier tilstanden brukeren har laget: valgt fane, åpent panel, åpen liste, åpen dialog. Komponenten setter den ikke tilbake når en morfing har fjernet den."
      }
    },
    "parts": {
      "trigger": {
        "selector": "button, [role='button']",
        "description": "Knappen som åpner og lukker panelet: den med `aria-controls` mot panelets id, ellers den første knappen utenfor panelet.",
        "content": "text"
      },
      "panel": {
        "selector": "[popover], .fs-popover",
        "description": "Panelet som åpnes: elementet med `popover`, eller klassen.",
        "content": "free"
      }
    },
    "events": {
      "popover-toggle": {
        "detail": {
          "open": "boolean"
        }
      }
    }
  },
  "fs-suggestion": {
    "link": "https://fristil.sobernetics.no/components/suggestion/",
    "description": "Felt med forslagsliste. En `<label>`, et `<input>`, en `.fs-suggestion__list` med `<li>` og et `[role=status]` er nok; komponenten setter rollene, id-ene og koblingen der markupen kom uten. Filtrerer mens brukeren skriver, flytter markeringen med piltastene og leser opp antall treff.",
    "attributes": {
      "prefiltered": {
        "type": "flag",
        "description": "Appen har alt filtrert lista, så komponenten lar den stå. Trengs når appens filter er et annet enn «teksten inneholder søkeordet»."
      },
      "count-none": {
        "type": "text",
        "description": "Opplesningen ved null treff. Standard er «Ingen treff»."
      },
      "count-zero": {
        "type": "text",
        "description": "Opplesningen i bøyningsformen `zero`, for språk som har den. `{n}` er tallet."
      },
      "count-one": {
        "type": "text",
        "description": "Opplesningen for ett treff. `{n}` er tallet."
      },
      "count-two": {
        "type": "text",
        "description": "Opplesningen i bøyningsformen `two`, for språk som har den. `{n}` er tallet."
      },
      "count-few": {
        "type": "text",
        "description": "Opplesningen i bøyningsformen `few`, for språk som har den. `{n}` er tallet."
      },
      "count-many": {
        "type": "text",
        "description": "Opplesningen i bøyningsformen `many`, for språk som har den. `{n}` er tallet."
      },
      "count-other": {
        "type": "text",
        "description": "Opplesningen for alle andre antall, og reserven når en form mangler. `{n}` er tallet."
      },
      "server-controlled": {
        "type": "flag",
        "description": "Serveren eier tilstanden brukeren har laget: valgt fane, åpent panel, åpen liste, åpen dialog. Komponenten setter den ikke tilbake når en morfing har fjernet den."
      }
    },
    "parts": {
      "control": {
        "selector": "[role='combobox'], input:not([type='hidden'])",
        "description": "Feltet brukeren skriver i: `role=\"combobox\"`, ellers det første `<input>`.",
        "content": "none"
      },
      "list": {
        "selector": "[role='listbox'], .fs-suggestion__list",
        "description": "Lista med forslag.",
        "content": "parts"
      },
      "option": {
        "selector": "[role='option'], .fs-suggestion__list > li:not([role])",
        "description": "Ett forslag i lista: `role=\"option\"`, eller et `<li>` uten rolle.",
        "content": "text",
        "multiple": true
      },
      "empty": {
        "selector": ".fs-suggestion__empty",
        "description": "Meldingen som vises når ingenting passer.",
        "content": "text",
        "optional": true
      },
      "status": {
        "selector": "[role='status']",
        "description": "Opplesningen av antall treff. Elementet står tomt, og komponenten fyller det.",
        "content": "none"
      }
    },
    "events": {
      "suggestion-select": {
        "detail": {
          "value": "string"
        }
      }
    }
  },
  "fs-dialog": {
    "link": "https://fristil.sobernetics.no/components/dialog/",
    "description": "Gjør en `<dialog class=\"fs-dialog\">` modal med `showModal()`, for servere som ikke kan kalle den selv. Verten rundt dialogen. Gir dialogen navnet sitt fra den første overskriften utenfor `fs-dialog__body` når verken `aria-labelledby` eller `aria-label` står der.",
    "attributes": {
      "open": {
        "type": "flag",
        "description": "Dialogen er åpen. Skal serveren vise den, må `open` også stå på `<dialog>`."
      },
      "server-controlled": {
        "type": "flag",
        "description": "Serveren eier tilstanden brukeren har laget: valgt fane, åpent panel, åpen liste, åpen dialog. Komponenten setter den ikke tilbake når en morfing har fjernet den."
      }
    },
    "parts": {
      "dialog": {
        "selector": ":scope > dialog",
        "description": "`<dialog>`-elementet, som et direkte barn av verten.",
        "content": "free"
      },
      "title": {
        "selector": "h1, h2, h3, h4, h5, h6",
        "description": "Tittelen: det `aria-labelledby` peker på, ellers den første overskriften utenfor kroppen. Med `aria-label` på `<dialog>` trengs den ikke.",
        "content": "text",
        "optional": true
      },
      "body": {
        "selector": ".fs-dialog__body",
        "description": "Kroppen, som ruller når dialogen blir for høy. En overskrift her blir ikke tittel.",
        "content": "free",
        "optional": true
      }
    },
    "events": {
      "dialog-toggle": {
        "detail": {
          "open": "boolean",
          "returnValue": "string"
        }
      }
    }
  },
  "fs-toast": {
    "link": "https://fristil.sobernetics.no/components/toast/",
    "description": "Kø av korte meldinger i hjørnet av skjermen. Meldingene lages fra skript med `show(tekst, { color, duration })`.",
    "attributes": {
      "duration": {
        "type": "number",
        "description": "Millisekunder før en melding forsvinner. Standard er 6000, og 0 lar meldingene stå."
      },
      "label": {
        "type": "text",
        "description": "Tekst som sier hva regionen er for skjermlesere."
      },
      "close-label": {
        "type": "text",
        "description": "Hva lukkeknappen i hver melding heter for skjermlesere. Standard er «Lukk melding»."
      }
    },
    "parts": {},
    "events": {
      "toast-dismiss": {}
    }
  },
  "fs-session-timeout": {
    "link": "https://fristil.sobernetics.no/components/session-timeout/",
    "description": "Varsler før en innlogget økt går ut, og teller ned. Den som rendrer skriver dialogen og teksten inni elementet: en `<dialog>` med `.fs-session-timeout__count` for tallet, `[role=status]` for opplesningen og knappene i et `<form method=\"dialog\">`. Sender `session-warn` når dialogen åpner, `session-extend` når brukeren vil fortsette, `session-logout` når brukeren logger ut, `session-expired` når tiden er ute, og `session-activity` høyst én gang per `activity-interval` mens brukeren er aktiv, så appen kan holde serverøkten i live.",
    "attributes": {
      "warn-at": {
        "type": "number",
        "description": "Sekunder uten aktivitet før varselet kommer."
      },
      "expires-at": {
        "type": "number",
        "description": "Sekunder uten aktivitet før økten er ute."
      },
      "activity-interval": {
        "type": "number",
        "description": "Sekunder mellom hver `session-activity` mens brukeren er aktiv. Standard 60."
      }
    },
    "parts": {
      "dialog": {
        "selector": "dialog",
        "description": "`<dialog>`-elementet med varselet.",
        "content": "free"
      },
      "title": {
        "selector": "h1, h2, h3, h4, h5, h6",
        "description": "Overskriften i dialogen, som blir navnet dens når verken `aria-labelledby` eller `aria-label` står på `<dialog>`.",
        "content": "text",
        "optional": true
      },
      "text": {
        "selector": ".fs-session-timeout__text",
        "description": "Avsnittet med tiden som er igjen. Opplesningen er dette avsnittet med tallet byttet ut.",
        "content": "text"
      },
      "count": {
        "selector": ".fs-session-timeout__count",
        "description": "Tallet som telles ned, inne i avsnittet. Komponenten fyller det.",
        "content": "none"
      },
      "status": {
        "selector": "[role=status]",
        "description": "Opplesningen. Elementet står tomt, og komponenten fyller det.",
        "content": "none"
      },
      "button": {
        "selector": "form[method=\"dialog\" i] button",
        "description": "Knappene i `<form method=\"dialog\">`, som forlenger økten eller logger ut.",
        "content": "text",
        "multiple": true
      }
    },
    "events": {
      "session-warn": {},
      "session-extend": {},
      "session-logout": {},
      "session-expired": {},
      "session-activity": {}
    }
  },
  "fs-connection-status": {
    "link": "https://fristil.sobernetics.no/components/connection-status/",
    "description": "Sier fra når forbindelsen til serveren er borte. Appen melder fra med `reportFailure()` og `reportSuccess()`.",
    "attributes": {
      "offline-text": {
        "type": "text",
        "description": "Teksten når forbindelsen er borte."
      },
      "online-text": {
        "type": "text",
        "description": "Teksten når den kommer tilbake."
      }
    },
    "parts": {},
    "events": {
      "connection-lost": {},
      "connection-restored": {}
    }
  }
}
