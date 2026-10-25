// Generert av designsystem/scripts/generate-ordforrad.ts. Ikke rediger.
import type { Elements } from "./types.js"

export const elements: Elements = {
  "fs-field": {
    "link": "https://fristil.sobernetics.no/components/field/",
    "description": "Kobler ledetekst, felt, hjelpetekst og feilmelding sammen: setter `aria-describedby` og `aria-invalid` på kontrollen og id på hjelpeteksten og feilmeldingen. Skriver aldri id på kontrollen: malen skriver `for` og `id`, eller legger ledeteksten rundt feltet. Feltet er ugyldig når feilmeldingen står uten `hidden`. Finnes for markup som blir til uten JavaScript. Lages markupen med JavaScript, bruk `fs.field()` i stedet.",
    "attributes": {
      "disabled": {
        "type": "flag",
        "description": "Kontrollen er slått av."
      },
      "optional": {
        "type": "flag",
        "description": "Feltet er valgfritt, og ledeteksten sier det."
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
        "description": "Kontrollen feltet kobler: et `<input>`, `<textarea>` eller `<select>` med sine `<option>`. `type=\"hidden\"` teller ikke, og bare den første får koblingen. Malen skriver `for` på ledeteksten og `id` på kontrollen, eller legger ledeteksten rundt den.",
        "content": "none",
        "unique": true,
        "stableId": true
      },
      "help": {
        "selector": ".fs-help-text",
        "description": "Hjelpeteksten, som leses opp sammen med kontrollen.",
        "content": "text",
        "unique": true,
        "optional": true
      },
      "error": {
        "selector": ".fs-error-text",
        "description": "Feilmeldingen, som vises og leses opp når feltet er ugyldig.",
        "content": "text",
        "unique": true,
        "optional": true
      }
    },
    "removed": {
      "invalid": "Feltet er ugyldig når feilmeldingen, `.fs-error-text`, står synlig, eller når serveren har skrevet `aria-invalid` på kontrollen. I Datastar: `data-attr:hidden=\"!$ugyldig\"` på feilmeldingen.",
      "required-marker": "Påkrevd-merket står som `data-required` på `<label>`, og vises da også uten JavaScript.",
      "control-id": "Skriv `id` på kontrollen og `for` på ledeteksten i malen. Komponenten skriver aldri id på kontrollen."
    }
  },
  "fs-tabs": {
    "link": "https://fristil.sobernetics.no/components/tabs/",
    "description": "Fanerad. Fanene er lenker til panelene i en `.fs-tabs__list`, så raden er en innholdsfortegnelse uten JavaScript; `role=\"tab\"` på noe annet enn en lenke er ikke en fane. Komponenten gir tastatur og fokus, setter roller og kobling, gir panelet fanens navn, gjør bare det valgte panelet til en tabbestopp, og skjuler resten med `hidden=\"until-found\"`, så søk i siden og lenker inn i et panel finner dem. Hvert valg skrives i adressen. Den skriver aldri id på en fane eller et panel. Når siden lastes, er den valgte fanen den med `aria-selected` fra serveren, ellers den adressen peker på, ellers den første som ikke er skjult med `hidden`. Under `server-controlled` velger adressen aldri.",
    "attributes": {
      "server-controlled": {
        "type": "flag",
        "description": "Serveren bestemmer hvilken fane som er valgt. Komponenten setter ikke brukerens valg tilbake etter en oppdatering fra serveren, og adressen velger ingen fane. Et klikk og søk i siden velger fanen til serveren svarer."
      },
      "activation": {
        "type": "values",
        "values": [
          "manual",
          "automatic"
        ],
        "description": "Hva piltastene gjør. Standard er at de velger fanen med en gang."
      }
    },
    "parts": {
      "list": {
        "selector": "[role='tablist'], .fs-tabs__list",
        "description": "Raden med fanene, en `<ul>` der hvert `<li>` får `role=\"presentation\"`. Den må ha et navn, som `aria-label`. Har serveren skrevet `role=\"tab\"` på lenkene, kan raden også ha andre lenker.",
        "content": "free",
        "unique": true
      },
      "tab": {
        "selector": "a[role='tab'][href^='#'], .fs-tabs__list a[href^='#']:not([role])",
        "description": "En fane: en lenke til panelet sitt, `<a href=\"#vedlegg\">`. Komponenten skriver `aria-controls` fra `href`. `role=\"tab\"` på noe som ikke er en lenke, er ikke en fane.",
        "content": "text",
        "multiple": true
      },
      "panel": {
        "selector": "[role='tabpanel'], .fs-tabs__panel:not([role])",
        "description": "Innholdet til én fane, med id-en lenken peker på. Panelet heter det fanen heter: overskriften øverst i panelet er navnet når den sier det samme som fanen.",
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
    "description": "Panel som henger under en knapp og lukker seg selv. En knapp og et panel med klassen `fs-popover` og en id fra malen; komponenten setter `popover` og `aria-controls` der markupen kom uten, men aldri id-en.",
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
        "description": "Serveren bestemmer om panelet er åpent. Komponenten setter ikke `open` tilbake når en oppdatering fra serveren fjerner det."
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
        "description": "Panelet som åpnes: elementet med `popover`, eller klassen. Det må ha en id fra serveren, som `aria-controls` på knappen peker på. Komponenten lager aldri en, og uten den kan knappen ikke kobles til panelet.",
        "content": "free",
        "stableId": true
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
    "description": "Felt med forslagsliste. En `<label for>`, et `<input id>`, en `.fs-suggestion__list` med `<li>` og et `[role=status]` er nok; komponenten setter rollene og koblingen der markupen kom uten, og gir lista og alternativene id. Feltet får aldri id av komponenten. Filtrerer mens brukeren skriver, flytter markeringen med piltastene og leser opp antall treff.",
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
        "description": "Serveren bestemmer om lista er utvidet og hvilket alternativ som er markert. Komponenten setter dem ikke tilbake etter en oppdatering fra serveren."
      }
    },
    "parts": {
      "control": {
        "selector": "[role='combobox'], input:not([type='hidden'])",
        "description": "Feltet brukeren skriver i: `role=\"combobox\"`, ellers det første `<input>`. Malen skriver `for` på ledeteksten og `id` på feltet, eller legger ledeteksten rundt det.",
        "content": "none",
        "unique": true,
        "stableId": true
      },
      "list": {
        "selector": "[role='listbox'], .fs-suggestion__list",
        "description": "Lista med forslag. Den står i det øverste laget når den er åpen, `popover=\"manual\"`, og har ledeteksten som navn.",
        "content": "parts",
        "unique": true
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
        "unique": true,
        "optional": true
      },
      "status": {
        "selector": "[role='status']",
        "description": "Opplesningen av antall treff. Elementet står tomt, og komponenten fyller det.",
        "content": "none"
      },
      "value": {
        "selector": "input.fs-suggestion__value",
        "description": "Et skjult `<input>` som får `data-value` til alternativet brukeren valgte. Uten det sendes bare teksten i feltet.",
        "content": "none",
        "unique": true,
        "optional": true
      }
    },
    "events": {
      "suggestion-select": {
        "detail": {
          "value": "string",
          "label": "string"
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
        "description": "Fjerner en oppdatering fra serveren `open` fra `<dialog>` mens dialogen er åpen, lukker komponenten den og sender `dialog-toggle`, i stedet for å sette `open` tilbake."
      }
    },
    "parts": {
      "dialog": {
        "selector": ":scope > dialog",
        "description": "`<dialog>`-elementet, som et direkte barn av verten.",
        "content": "free",
        "unique": true
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
        "unique": true,
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
        "content": "free",
        "unique": true
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
        "content": "text",
        "unique": true
      },
      "count": {
        "selector": ".fs-session-timeout__count",
        "description": "Tallet som telles ned, inne i avsnittet. Komponenten fyller det.",
        "content": "none",
        "unique": true
      },
      "status": {
        "selector": "[role='status']",
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
