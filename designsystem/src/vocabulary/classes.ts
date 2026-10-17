// Generert av designsystem/scripts/generate-ordforrad.ts. Ikke rediger.
import type { Classes } from "./types.js"

export const classes: Classes = {
  "fs-accordion": {
    "component": "accordion",
    "title": "Accordion",
    "description": "Panel som kan foldes ut, bygget på details og summary. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/accordion/",
    "content": "parts",
    "parts": {
      "summary": {
        "selector": "summary",
        "description": "Overskriften brukeren trykker på for å åpne og lukke. En `<h2>` til `<h6>` inni gir den et nivå i dokumentet.",
        "content": "free"
      },
      "content": {
        "selector": ".fs-accordion__content",
        "description": "Innholdet som vises når panelet er åpent.",
        "content": "free"
      }
    },
    "attributes": {
      "data-variant": {
        "values": [
          "plain"
        ],
        "default": "default"
      }
    }
  },
  "fs-accordion__content": {
    "component": "accordion",
    "title": "Accordion",
    "description": "Panel som kan foldes ut, bygget på details og summary. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/accordion/",
    "content": "free",
    "partOf": "fs-accordion",
    "attributes": {}
  },
  "fs-alert": {
    "component": "alert",
    "title": "Alert",
    "description": "Melding som gjelder hele siden eller hele skjemaet. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/alert/",
    "content": "free",
    "parts": {
      "title": {
        "selector": ".fs-alert__title",
        "description": "Overskriften i meldingen.",
        "content": "text",
        "optional": true
      }
    },
    "attributes": {
      "data-color": {
        "values": [
          "info",
          "success",
          "warning",
          "danger"
        ]
      }
    }
  },
  "fs-alert__title": {
    "component": "alert",
    "title": "Alert",
    "description": "Melding som gjelder hele siden eller hele skjemaet. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/alert/",
    "content": "text",
    "partOf": "fs-alert",
    "attributes": {}
  },
  "fs-avatar": {
    "component": "avatar",
    "title": "Avatar",
    "description": "Profilbilde eller initialer. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/avatar/",
    "content": "free",
    "parts": {
      "image": {
        "selector": "img",
        "description": "Bildet, med navnet i `alt`. Uten bilde står initialene som tekst, og elementet har `aria-hidden` når navnet står ved siden av.",
        "content": "none",
        "optional": true
      }
    },
    "attributes": {
      "data-variant": {
        "values": [
          "square"
        ],
        "default": "circle"
      },
      "data-size": {
        "values": [
          "small",
          "large"
        ],
        "default": "medium"
      }
    }
  },
  "fs-avatar-stack": {
    "component": "avatar",
    "title": "Avatar",
    "description": "Profilbilde eller initialer. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/avatar/",
    "content": "parts",
    "parts": {
      "item": {
        "selector": "li",
        "description": "Ett listepunkt per person.",
        "content": "parts",
        "multiple": true
      },
      "avatar": {
        "selector": "li > .fs-avatar",
        "description": "Avataren i hvert listepunkt.",
        "content": "free",
        "multiple": true
      }
    },
    "attributes": {}
  },
  "fs-badge": {
    "component": "badge",
    "title": "Badge",
    "description": "Kompakt statusmerke. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/badge/",
    "content": "text",
    "attributes": {
      "data-color": {
        "values": [
          "success",
          "warning",
          "danger",
          "neutral"
        ],
        "default": "info"
      }
    }
  },
  "fs-breadcrumbs": {
    "component": "breadcrumbs",
    "title": "Breadcrumbs",
    "description": "Brødsmulesti som viser hvor på siden brukeren er. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/breadcrumbs/",
    "content": "parts",
    "parts": {
      "item": {
        "selector": "li",
        "description": "Ett steg i stien.",
        "content": "parts",
        "multiple": true
      },
      "link": {
        "selector": "li > a",
        "description": "Lenken til steget. Det siste, siden leseren står på, har `aria-current=\"page\"`.",
        "content": "text",
        "multiple": true
      }
    },
    "attributes": {}
  },
  "fs-button": {
    "component": "button",
    "title": "Button",
    "description": "Knapp for handlinger. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/button/",
    "content": "text",
    "attributes": {
      "data-variant": {
        "values": [
          "secondary",
          "ghost",
          "danger"
        ],
        "default": "primary"
      }
    }
  },
  "fs-card": {
    "component": "card",
    "title": "Card",
    "description": "Boks som samler innhold som hører sammen. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/card/",
    "content": "free",
    "parts": {
      "title": {
        "selector": ".fs-card__title",
        "description": "Overskriften i kortet.",
        "content": "text",
        "optional": true
      }
    },
    "attributes": {
      "data-variant": {
        "values": [
          "filled"
        ],
        "default": "outline"
      },
      "data-interactive": {
        "values": [],
        "flag": true
      }
    }
  },
  "fs-card__title": {
    "component": "card",
    "title": "Card",
    "description": "Boks som samler innhold som hører sammen. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/card/",
    "content": "text",
    "partOf": "fs-card",
    "attributes": {}
  },
  "fs-checkbox": {
    "component": "checkbox",
    "title": "Checkbox",
    "description": "Avkryssingsboks for valg som står for seg selv. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/checkbox/",
    "content": "none",
    "attributes": {
      "data-state": {
        "values": [
          "invalid",
          "success"
        ],
        "default": "default"
      }
    }
  },
  "fs-checkbox-row": {
    "component": "checkbox",
    "title": "Checkbox",
    "description": "Avkryssingsboks for valg som står for seg selv. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/checkbox/",
    "content": "parts",
    "parts": {
      "control": {
        "selector": "input[type='checkbox']",
        "description": "Avkryssingsboksen, med klassen sin.",
        "content": "none"
      },
      "label": {
        "selector": "label",
        "description": "Ledeteksten, koblet til kontrollen med `for`.",
        "content": "text"
      }
    },
    "attributes": {}
  },
  "fs-divider": {
    "component": "divider",
    "title": "Divider",
    "description": "Skillelinje mellom deler av innholdet. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/divider/",
    "content": "none",
    "attributes": {
      "data-variant": {
        "values": [
          "subtle",
          "strong"
        ],
        "default": "default"
      }
    }
  },
  "fs-error-text": {
    "component": "error-text",
    "title": "Error Text",
    "description": "Feilmelding under et skjemafelt. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/error-text/",
    "content": "text",
    "attributes": {
      "data-variant": {
        "values": [
          "warning"
        ],
        "default": "error"
      }
    }
  },
  "fs-fieldset": {
    "component": "fieldset",
    "title": "Fieldset",
    "description": "Gruppe av kontroller med en felles ledetekst. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/fieldset/",
    "content": "free",
    "parts": {
      "legend": {
        "selector": ".fs-legend",
        "description": "Ledeteksten til gruppen, en `<legend>` med klassen.",
        "content": "text"
      },
      "help": {
        "selector": ".fs-help-text",
        "description": "Hjelpeteksten til gruppen, koblet med `aria-describedby` på feltsettet.",
        "content": "text",
        "optional": true
      },
      "error": {
        "selector": ".fs-error-text",
        "description": "Feilmeldingen til gruppen, koblet med `aria-describedby` på feltsettet.",
        "content": "text",
        "optional": true
      }
    },
    "attributes": {
      "data-state": {
        "values": [
          "invalid",
          "success"
        ],
        "default": "default"
      }
    }
  },
  "fs-legend": {
    "component": "fieldset",
    "title": "Fieldset",
    "description": "Gruppe av kontroller med en felles ledetekst. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/fieldset/",
    "content": "text",
    "partOf": "fs-fieldset",
    "attributes": {
      "data-required": {
        "values": [
          "symbol",
          "text"
        ]
      },
      "data-optional": {
        "values": [],
        "flag": true
      }
    }
  },
  "fs-file-upload": {
    "component": "file-upload",
    "title": "File Upload",
    "description": "Felt for opplasting av filer. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/file-upload/",
    "content": "none",
    "attributes": {
      "data-state": {
        "values": [
          "invalid",
          "success"
        ],
        "default": "default"
      }
    }
  },
  "fs-file-upload-list": {
    "component": "file-upload",
    "title": "File Upload",
    "description": "Felt for opplasting av filer. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/file-upload/",
    "content": "parts",
    "parts": {
      "item": {
        "selector": "li",
        "description": "Én valgt fil, med navnet.",
        "content": "free",
        "multiple": true
      },
      "remove": {
        "selector": "li > button",
        "description": "Knappen som fjerner fila, med filnavnet i teksten.",
        "content": "text",
        "multiple": true,
        "optional": true
      }
    },
    "attributes": {}
  },
  "fs-heading": {
    "component": "heading",
    "title": "Heading",
    "description": "Overskrifter i seks størrelser, uavhengig av nivå. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/heading/",
    "content": "text",
    "attributes": {
      "data-size": {
        "values": [
          "xs",
          "s",
          "m",
          "xl",
          "mega"
        ],
        "default": "l"
      }
    }
  },
  "fs-help-text": {
    "component": "help-text",
    "title": "Help Text",
    "description": "Forklarende tekst under et skjemafelt. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/help-text/",
    "content": "text",
    "attributes": {
      "data-variant": {
        "values": [
          "strong",
          "success",
          "warning"
        ],
        "default": "muted"
      }
    }
  },
  "fs-icon": {
    "component": "icon",
    "title": "Icon",
    "description": "Ikon fra appens eget sett, like stort som teksten rundt. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/icon/",
    "content": "none",
    "attributes": {}
  },
  "fs-input": {
    "component": "input",
    "title": "Input",
    "description": "Tekstfelt for skjema, med tilstander for gyldig og ugyldig. CSS-komponent.",
    "link": "https://fristil.sobernetics.no/components/input/",
    "content": "none",
    "attributes": {
      "data-state": {
        "values": [
          "invalid",
          "success"
        ],
        "default": "default"
      },
      "data-variant": {
        "values": [
          "date",
          "datetime-local",
          "time"
        ]
      }
    }
  },
  "fs-label": {
    "component": "label",
    "title": "Label",
    "description": "Ledetekst for skjemafelt, med markering av påkrevd og valgfritt. CSS-komponent.",
    "link": "https://fristil.sobernetics.no/components/label/",
    "content": "text",
    "attributes": {
      "data-required": {
        "values": [
          "symbol",
          "text"
        ]
      },
      "data-optional": {
        "values": [],
        "flag": true
      }
    }
  },
  "fs-link": {
    "component": "link",
    "title": "Link",
    "description": "Lenkestil for navigasjon i løpende tekst. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/link/",
    "content": "text",
    "attributes": {}
  },
  "fs-list": {
    "component": "list",
    "title": "List",
    "description": "Punktliste, nummerert liste og lister uten punkter. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/list/",
    "content": "parts",
    "parts": {
      "item": {
        "selector": "li",
        "description": "Ett punkt i lista.",
        "content": "free",
        "multiple": true
      }
    },
    "attributes": {
      "data-variant": {
        "values": [
          "plain",
          "divided"
        ],
        "default": "default"
      }
    }
  },
  "fs-pagination": {
    "component": "pagination",
    "title": "Pagination",
    "description": "Sidenavigering for lange lister. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/pagination/",
    "content": "parts",
    "parts": {
      "item": {
        "selector": "li",
        "description": "Ett listepunkt per side, pil og hull.",
        "content": "parts",
        "multiple": true
      },
      "link": {
        "selector": "li > a, li > button",
        "description": "Lenken eller knappen til en side, med sidetallet som tekst og `aria-label` som sier hva det er. Den gjeldende har `aria-current=\"page\"`.",
        "content": "text",
        "multiple": true
      },
      "gap": {
        "selector": ".fs-pagination__gap",
        "description": "Hullet der sider er utelatt.",
        "content": "text",
        "multiple": true,
        "optional": true
      }
    },
    "attributes": {}
  },
  "fs-pagination__gap": {
    "component": "pagination",
    "title": "Pagination",
    "description": "Sidenavigering for lange lister. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/pagination/",
    "content": "text",
    "partOf": "fs-pagination",
    "attributes": {}
  },
  "fs-paragraph": {
    "component": "paragraph",
    "title": "Paragraph",
    "description": "Brødtekst og ingress med begrenset linjelengde. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/paragraph/",
    "content": "text",
    "attributes": {
      "data-variant": {
        "values": [
          "lead"
        ],
        "default": "default"
      },
      "data-size": {
        "values": [
          "small",
          "large"
        ],
        "default": "medium"
      }
    }
  },
  "fs-progress": {
    "component": "progress",
    "title": "Progress",
    "description": "Framdriftsstolpe for noe som har en ende. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/progress/",
    "content": "none",
    "attributes": {
      "data-color": {
        "values": [
          "success",
          "warning",
          "danger"
        ]
      }
    }
  },
  "fs-radio": {
    "component": "radio",
    "title": "Radio",
    "description": "Radioknapper for ett valg blant flere. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/radio/",
    "content": "none",
    "attributes": {
      "data-state": {
        "values": [
          "invalid",
          "success"
        ],
        "default": "default"
      }
    }
  },
  "fs-radio-row": {
    "component": "radio",
    "title": "Radio",
    "description": "Radioknapper for ett valg blant flere. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/radio/",
    "content": "parts",
    "parts": {
      "control": {
        "selector": "input[type='radio']",
        "description": "Radioknappen, med klassen sin.",
        "content": "none"
      },
      "label": {
        "selector": "label",
        "description": "Ledeteksten, koblet til kontrollen med `for`.",
        "content": "text"
      }
    },
    "attributes": {}
  },
  "fs-search": {
    "component": "search",
    "title": "Search",
    "description": "Søkefelt med forstørrelsesglass. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/search/",
    "content": "none",
    "attributes": {
      "data-state": {
        "values": [
          "invalid",
          "success"
        ],
        "default": "default"
      }
    }
  },
  "fs-search-row": {
    "component": "search",
    "title": "Search",
    "description": "Søkefelt med forstørrelsesglass. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/search/",
    "content": "parts",
    "parts": {
      "label": {
        "selector": "label",
        "description": "Ledeteksten, koblet med `for`. Gjerne skjult med `fs-sr-only`.",
        "content": "text"
      },
      "control": {
        "selector": "input[type='search']",
        "description": "Søkefeltet, med klassene `fs-input fs-search`.",
        "content": "none"
      },
      "button": {
        "selector": "button",
        "description": "Søkeknappen.",
        "content": "text",
        "optional": true
      }
    },
    "attributes": {}
  },
  "fs-select": {
    "component": "select",
    "title": "Select",
    "description": "Nedtrekksliste. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/select/",
    "content": "none",
    "attributes": {
      "data-state": {
        "values": [
          "invalid",
          "success"
        ],
        "default": "default"
      },
      "data-picker": {
        "values": [
          "styled"
        ],
        "default": "auto"
      }
    }
  },
  "fs-skeleton": {
    "component": "skeleton",
    "title": "Skeleton",
    "description": "Plassholder som viser formen på innhold som lastes. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/skeleton/",
    "content": "none",
    "attributes": {
      "data-variant": {
        "values": [
          "text",
          "circle"
        ],
        "default": "block"
      }
    }
  },
  "fs-skip-link": {
    "component": "skip-link",
    "title": "Skip Link",
    "description": "Lenke som hopper forbi menyen til hovedinnholdet. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/skip-link/",
    "content": "text",
    "attributes": {}
  },
  "fs-spinner": {
    "component": "spinner",
    "title": "Spinner",
    "description": "Venteindikator for noe som pågår. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/spinner/",
    "content": "none",
    "attributes": {
      "data-size": {
        "values": [
          "small",
          "large"
        ],
        "default": "medium"
      }
    }
  },
  "fs-sr-only": {
    "component": "sr-only",
    "title": "Sr Only",
    "description": "Tekst som bare skjermlesere får. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/sr-only/",
    "content": "text",
    "attributes": {}
  },
  "fs-switch": {
    "component": "switch",
    "title": "Switch",
    "description": "Bryter for en innstilling som slår inn med en gang. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/switch/",
    "content": "none",
    "attributes": {}
  },
  "fs-switch-row": {
    "component": "switch",
    "title": "Switch",
    "description": "Bryter for en innstilling som slår inn med en gang. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/switch/",
    "content": "parts",
    "parts": {
      "control": {
        "selector": "input[role='switch']",
        "description": "Bryteren, med klassen sin.",
        "content": "none"
      },
      "label": {
        "selector": "label",
        "description": "Ledeteksten, koblet til kontrollen med `for`.",
        "content": "text"
      }
    },
    "attributes": {}
  },
  "fs-table": {
    "component": "table",
    "title": "Table",
    "description": "Tabell for data i rader og kolonner. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/table/",
    "content": "parts",
    "parts": {
      "caption": {
        "selector": "caption",
        "description": "Tabellens navn.",
        "content": "text",
        "optional": true
      },
      "head": {
        "selector": "thead",
        "description": "Overskriftsraden, med `<th scope=\"col\">` per kolonne.",
        "content": "free"
      },
      "body": {
        "selector": "tbody",
        "description": "Radene. En `<th scope=\"row\">` først i raden gir raden et navn.",
        "content": "free"
      },
      "sort": {
        "selector": "th > .fs-table__sort",
        "description": "Knappen i en overskrift som kan sorteres. `aria-sort` på cellen sier hvilken vei.",
        "content": "text",
        "multiple": true,
        "optional": true
      }
    },
    "attributes": {
      "data-variant": {
        "values": [
          "striped"
        ],
        "default": "default"
      },
      "data-hoverable": {
        "values": [],
        "flag": true
      }
    }
  },
  "fs-table__sort": {
    "component": "table",
    "title": "Table",
    "description": "Tabell for data i rader og kolonner. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/table/",
    "content": "text",
    "partOf": "fs-table",
    "attributes": {}
  },
  "fs-table-scroll": {
    "component": "table",
    "title": "Table",
    "description": "Tabell for data i rader og kolonner. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/table/",
    "content": "parts",
    "parts": {
      "table": {
        "selector": ".fs-table",
        "description": "Tabellen som kan rulles sidelengs.",
        "content": "free"
      }
    },
    "attributes": {}
  },
  "fs-tag": {
    "component": "tag",
    "title": "Tag",
    "description": "Merkelapp for emneord og filtre. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/tag/",
    "content": "text",
    "attributes": {
      "data-variant": {
        "values": [
          "filled"
        ],
        "default": "outline"
      },
      "data-selectable": {
        "values": [],
        "flag": true
      }
    }
  },
  "fs-textarea": {
    "component": "textarea",
    "title": "Textarea",
    "description": "Flerlinjet tekstfelt. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/textarea/",
    "content": "none",
    "attributes": {
      "data-state": {
        "values": [
          "invalid",
          "success"
        ],
        "default": "default"
      }
    }
  },
  "fs-toggle-group": {
    "component": "toggle-group",
    "title": "Toggle Group",
    "description": "Gruppe der ett alternativ er valgt om gangen. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/toggle-group/",
    "content": "parts",
    "parts": {
      "legend": {
        "selector": "legend",
        "description": "Hva alternativene velger mellom. Kan skjules med `fs-sr-only`, men må stå der.",
        "content": "text"
      },
      "option": {
        "selector": ".fs-toggle-group__option",
        "description": "Ett alternativ: en `<label>` med radioknappen og teksten.",
        "content": "free",
        "multiple": true
      },
      "radio": {
        "selector": ".fs-toggle-group__option > input[type='radio']",
        "description": "Radioknappen i hvert alternativ, med samme `name`.",
        "content": "none",
        "multiple": true
      }
    },
    "attributes": {}
  },
  "fs-toggle-group__option": {
    "component": "toggle-group",
    "title": "Toggle Group",
    "description": "Gruppe der ett alternativ er valgt om gangen. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/toggle-group/",
    "content": "free",
    "partOf": "fs-toggle-group",
    "attributes": {}
  },
  "fs-tooltip": {
    "component": "tooltip",
    "title": "Tooltip",
    "description": "Liten hjelpetekst som vises på hover og fokus. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/tooltip/",
    "content": "parts",
    "parts": {
      "trigger": {
        "selector": "[aria-describedby]",
        "description": "Elementet boblen beskriver, med `aria-describedby` mot boblens id.",
        "content": "text"
      },
      "bubble": {
        "selector": ".fs-tooltip__bubble",
        "description": "Boblen, med `role=\"tooltip\"` og id-en.",
        "content": "text"
      }
    },
    "attributes": {}
  },
  "fs-tooltip__bubble": {
    "component": "tooltip",
    "title": "Tooltip",
    "description": "Liten hjelpetekst som vises på hover og fokus. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://fristil.sobernetics.no/components/tooltip/",
    "content": "text",
    "partOf": "fs-tooltip",
    "attributes": {}
  },
  "fs-dialog": {
    "component": "dialog",
    "title": "Dialog",
    "description": "Modal dialog bygget på det native dialog-elementet. Seks klasser og ingen JavaScript, med en valgfri komponent for servere som ikke kan kalle showModal().",
    "link": "https://fristil.sobernetics.no/components/dialog/",
    "content": "free",
    "parts": {
      "header": {
        "selector": ".fs-dialog__header",
        "description": "Toppen, med overskriften og underteksten. `data-color` på dialogen farger den.",
        "content": "parts",
        "optional": true
      },
      "title": {
        "selector": ".fs-dialog__title",
        "description": "Overskriften, som `aria-labelledby` peker på.",
        "content": "text",
        "optional": true
      },
      "subtitle": {
        "selector": ".fs-dialog__subtitle",
        "description": "Linja under overskriften, inne i toppen.",
        "content": "text",
        "optional": true
      },
      "body": {
        "selector": ".fs-dialog__body",
        "description": "Innholdet, som ruller når dialogen blir for høy. Må være et direkte barn.",
        "content": "free",
        "optional": true
      },
      "footer": {
        "selector": ".fs-dialog__footer",
        "description": "Raden med knapper nederst, gjerne et `<form method=\"dialog\">`.",
        "content": "free",
        "optional": true
      }
    },
    "attributes": {
      "data-color": {
        "values": [
          "brand",
          "info",
          "success",
          "warning",
          "danger"
        ],
        "default": "neutral"
      }
    }
  },
  "fs-dialog__body": {
    "component": "dialog",
    "title": "Dialog",
    "description": "Modal dialog bygget på det native dialog-elementet. Seks klasser og ingen JavaScript, med en valgfri komponent for servere som ikke kan kalle showModal().",
    "link": "https://fristil.sobernetics.no/components/dialog/",
    "content": "free",
    "partOf": "fs-dialog",
    "attributes": {}
  },
  "fs-dialog__title": {
    "component": "dialog",
    "title": "Dialog",
    "description": "Modal dialog bygget på det native dialog-elementet. Seks klasser og ingen JavaScript, med en valgfri komponent for servere som ikke kan kalle showModal().",
    "link": "https://fristil.sobernetics.no/components/dialog/",
    "content": "text",
    "partOf": "fs-dialog",
    "attributes": {}
  },
  "fs-dialog__footer": {
    "component": "dialog",
    "title": "Dialog",
    "description": "Modal dialog bygget på det native dialog-elementet. Seks klasser og ingen JavaScript, med en valgfri komponent for servere som ikke kan kalle showModal().",
    "link": "https://fristil.sobernetics.no/components/dialog/",
    "content": "free",
    "partOf": "fs-dialog",
    "attributes": {}
  },
  "fs-dialog__header": {
    "component": "dialog",
    "title": "Dialog",
    "description": "Modal dialog bygget på det native dialog-elementet. Seks klasser og ingen JavaScript, med en valgfri komponent for servere som ikke kan kalle showModal().",
    "link": "https://fristil.sobernetics.no/components/dialog/",
    "content": "parts",
    "partOf": "fs-dialog",
    "parts": {
      "title": {
        "selector": ".fs-dialog__title",
        "description": "Overskriften.",
        "content": "text"
      },
      "subtitle": {
        "selector": ".fs-dialog__subtitle",
        "description": "Linja under overskriften.",
        "content": "text",
        "optional": true
      }
    },
    "attributes": {}
  },
  "fs-dialog__subtitle": {
    "component": "dialog",
    "title": "Dialog",
    "description": "Modal dialog bygget på det native dialog-elementet. Seks klasser og ingen JavaScript, med en valgfri komponent for servere som ikke kan kalle showModal().",
    "link": "https://fristil.sobernetics.no/components/dialog/",
    "content": "text",
    "partOf": "fs-dialog",
    "attributes": {}
  },
  "fs-error-summary": {
    "component": "error-summary",
    "title": "Error Summary",
    "description": "Samler feilene i et skjema og sender brukeren til feltet som feilet. Rammekomponent.",
    "link": "https://fristil.sobernetics.no/components/error-summary/",
    "content": "parts",
    "parts": {
      "title": {
        "selector": ".fs-error-summary__title",
        "description": "Overskriften, som sier hvor mange feil skjemaet har.",
        "content": "text"
      },
      "list": {
        "selector": "ul",
        "description": "Lista med én lenke per feil.",
        "content": "parts"
      },
      "link": {
        "selector": "li a[href^='#']",
        "description": "Lenken til et felt med feil, med feilmeldingen som tekst og feltets id etter `#`.",
        "content": "text",
        "multiple": true
      }
    },
    "attributes": {}
  },
  "fs-error-summary__title": {
    "component": "error-summary",
    "title": "Error Summary",
    "description": "Samler feilene i et skjema og sender brukeren til feltet som feilet. Rammekomponent.",
    "link": "https://fristil.sobernetics.no/components/error-summary/",
    "content": "text",
    "partOf": "fs-error-summary",
    "attributes": {}
  },
  "fs-popover": {
    "component": "popover",
    "title": "Popover",
    "description": "Panel som henger under en knapp og lukker seg selv. Rammekomponent.",
    "link": "https://fristil.sobernetics.no/components/popover/",
    "content": "free",
    "attributes": {}
  },
  "fs-session-timeout": {
    "component": "session-timeout",
    "title": "Session Timeout",
    "description": "Varsler før en innlogget økt går ut, og teller ned. Du skriver dialogen, komponenten tar tiden.",
    "link": "https://fristil.sobernetics.no/components/session-timeout/",
    "content": "parts",
    "parts": {
      "dialog": {
        "selector": ".fs-session-timeout__dialog",
        "description": "Dialogen med varselet, med `role=\"alertdialog\"`.",
        "content": "parts"
      },
      "title": {
        "selector": ".fs-session-timeout__title",
        "description": "Overskriften i dialogen.",
        "content": "text",
        "optional": true
      },
      "text": {
        "selector": ".fs-session-timeout__text",
        "description": "Avsnittet med tiden som er igjen.",
        "content": "text"
      },
      "count": {
        "selector": ".fs-session-timeout__count",
        "description": "Tallet som telles ned, inne i avsnittet. Komponenten fyller det.",
        "content": "none"
      },
      "status": {
        "selector": "[role='status']",
        "description": "Opplesningen. Står tomt, og komponenten fyller det.",
        "content": "none"
      },
      "actions": {
        "selector": ".fs-session-timeout__actions",
        "description": "Knapperaden, et `<form method=\"dialog\">`.",
        "content": "parts"
      },
      "button": {
        "selector": ".fs-session-timeout__actions button",
        "description": "Knappene som forlenger økten eller logger ut.",
        "content": "text",
        "multiple": true
      }
    },
    "attributes": {}
  },
  "fs-session-timeout__dialog": {
    "component": "session-timeout",
    "title": "Session Timeout",
    "description": "Varsler før en innlogget økt går ut, og teller ned. Du skriver dialogen, komponenten tar tiden.",
    "link": "https://fristil.sobernetics.no/components/session-timeout/",
    "content": "parts",
    "partOf": "fs-session-timeout",
    "parts": {
      "title": {
        "selector": ".fs-session-timeout__title",
        "description": "Overskriften.",
        "content": "text",
        "optional": true
      },
      "text": {
        "selector": ".fs-session-timeout__text",
        "description": "Avsnittet med tiden som er igjen.",
        "content": "text"
      },
      "count": {
        "selector": ".fs-session-timeout__count",
        "description": "Tallet som telles ned, inne i avsnittet.",
        "content": "none"
      },
      "status": {
        "selector": "[role='status']",
        "description": "Opplesningen, som komponenten fyller.",
        "content": "none"
      },
      "actions": {
        "selector": ".fs-session-timeout__actions",
        "description": "Knapperaden, et `<form method=\"dialog\">`.",
        "content": "parts"
      }
    },
    "attributes": {}
  },
  "fs-session-timeout__title": {
    "component": "session-timeout",
    "title": "Session Timeout",
    "description": "Varsler før en innlogget økt går ut, og teller ned. Du skriver dialogen, komponenten tar tiden.",
    "link": "https://fristil.sobernetics.no/components/session-timeout/",
    "content": "text",
    "partOf": "fs-session-timeout",
    "attributes": {}
  },
  "fs-session-timeout__text": {
    "component": "session-timeout",
    "title": "Session Timeout",
    "description": "Varsler før en innlogget økt går ut, og teller ned. Du skriver dialogen, komponenten tar tiden.",
    "link": "https://fristil.sobernetics.no/components/session-timeout/",
    "content": "text",
    "partOf": "fs-session-timeout",
    "attributes": {}
  },
  "fs-session-timeout__count": {
    "component": "session-timeout",
    "title": "Session Timeout",
    "description": "Varsler før en innlogget økt går ut, og teller ned. Du skriver dialogen, komponenten tar tiden.",
    "link": "https://fristil.sobernetics.no/components/session-timeout/",
    "content": "none",
    "partOf": "fs-session-timeout",
    "attributes": {}
  },
  "fs-session-timeout__actions": {
    "component": "session-timeout",
    "title": "Session Timeout",
    "description": "Varsler før en innlogget økt går ut, og teller ned. Du skriver dialogen, komponenten tar tiden.",
    "link": "https://fristil.sobernetics.no/components/session-timeout/",
    "content": "parts",
    "partOf": "fs-session-timeout",
    "parts": {
      "button": {
        "selector": "button",
        "description": "Knappene som forlenger økten eller logger ut.",
        "content": "text",
        "multiple": true
      }
    },
    "attributes": {}
  },
  "fs-suggestion__field": {
    "component": "suggestion",
    "title": "Suggestion",
    "description": "Felt med forslagsliste som snevrer seg inn mens brukeren skriver. Rammekomponent.",
    "link": "https://fristil.sobernetics.no/components/suggestion/",
    "content": "parts",
    "parts": {
      "control": {
        "selector": "input",
        "description": "Feltet brukeren skriver i.",
        "content": "none"
      },
      "list": {
        "selector": ".fs-suggestion__list",
        "description": "Lista med forslag.",
        "content": "parts"
      },
      "empty": {
        "selector": ".fs-suggestion__empty",
        "description": "Meldingen som vises når ingenting passer.",
        "content": "text",
        "optional": true
      },
      "status": {
        "selector": "[role='status']",
        "description": "Opplesningen av antall treff. Står tomt, og komponenten fyller det.",
        "content": "none"
      }
    },
    "attributes": {}
  },
  "fs-suggestion__list": {
    "component": "suggestion",
    "title": "Suggestion",
    "description": "Felt med forslagsliste som snevrer seg inn mens brukeren skriver. Rammekomponent.",
    "link": "https://fristil.sobernetics.no/components/suggestion/",
    "content": "parts",
    "partOf": "fs-suggestion__field",
    "parts": {
      "option": {
        "selector": "[role='option'], .fs-suggestion__option, > li:not([role])",
        "description": "Ett forslag: rollen eller klassen når de står der, ellers en `<li>` uten rolle, som komponenten gir klassen og rollen. Lista kan stå tom til serveren fyller den.",
        "content": "text",
        "multiple": true,
        "optional": true
      }
    },
    "attributes": {}
  },
  "fs-suggestion__option": {
    "component": "suggestion",
    "title": "Suggestion",
    "description": "Felt med forslagsliste som snevrer seg inn mens brukeren skriver. Rammekomponent.",
    "link": "https://fristil.sobernetics.no/components/suggestion/",
    "content": "text",
    "partOf": "fs-suggestion__list",
    "attributes": {}
  },
  "fs-suggestion__empty": {
    "component": "suggestion",
    "title": "Suggestion",
    "description": "Felt med forslagsliste som snevrer seg inn mens brukeren skriver. Rammekomponent.",
    "link": "https://fristil.sobernetics.no/components/suggestion/",
    "content": "text",
    "partOf": "fs-suggestion__field",
    "attributes": {}
  },
  "fs-tabs__list": {
    "component": "tabs",
    "title": "Tabs",
    "description": "Fanerad koblet til panelene sine. Rammekomponent.",
    "link": "https://fristil.sobernetics.no/components/tabs/",
    "content": "free",
    "parts": {
      "tab": {
        "selector": "[role='tab'], > button:not([role])",
        "description": "En fane: `role=\"tab\"`, eller en knapp uten rolle når ingen knapp i raden har rollen. Fane nummer n styrer panel nummer n. Har en fane rollen, kan raden også ha andre knapper.",
        "content": "text",
        "multiple": true
      }
    },
    "attributes": {}
  },
  "fs-tabs__panel": {
    "component": "tabs",
    "title": "Tabs",
    "description": "Fanerad koblet til panelene sine. Rammekomponent.",
    "link": "https://fristil.sobernetics.no/components/tabs/",
    "content": "free",
    "attributes": {}
  },
  "fs-connection-status": {
    "component": "connection-status",
    "title": "Connection Status",
    "description": "Sier fra når forbindelsen til serveren er borte. Frittstående komponent.",
    "link": "https://fristil.sobernetics.no/components/connection-status/",
    "content": "none",
    "attributes": {}
  },
  "fs-connection-status__bar": {
    "component": "connection-status",
    "title": "Connection Status",
    "description": "Sier fra når forbindelsen til serveren er borte. Frittstående komponent.",
    "link": "https://fristil.sobernetics.no/components/connection-status/",
    "content": "text",
    "attributes": {}
  },
  "fs-toast": {
    "component": "toast",
    "title": "Toast",
    "description": "Kø av korte meldinger i hjørnet av skjermen. Frittstående komponent.",
    "link": "https://fristil.sobernetics.no/components/toast/",
    "content": "none",
    "attributes": {}
  },
  "fs-toast__message": {
    "component": "toast",
    "title": "Toast",
    "description": "Kø av korte meldinger i hjørnet av skjermen. Frittstående komponent.",
    "link": "https://fristil.sobernetics.no/components/toast/",
    "content": "free",
    "attributes": {}
  },
  "fs-toast__close": {
    "component": "toast",
    "title": "Toast",
    "description": "Kø av korte meldinger i hjørnet av skjermen. Frittstående komponent.",
    "link": "https://fristil.sobernetics.no/components/toast/",
    "content": "text",
    "attributes": {}
  },
  "fs-theme-control": {
    "component": "tilpasning",
    "title": "Tilpasning",
    "description": "Endre farger, form og størrelse i Fristil uten at endringene forsvinner ved neste oppgradering.",
    "link": "https://fristil.sobernetics.no/tilpasning/",
    "content": "none",
    "attributes": {}
  }
}
