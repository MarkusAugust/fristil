// Generert av designsystem/scripts/generate-vocabulary.ts. Ikke rediger.
import type { Classes } from "./types.js"

export const classes: Classes = {
  "lt-accordion": {
    "component": "accordion",
    "title": "Accordion",
    "description": "Panel som kan foldes ut, bygget på details og summary. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/accordion/",
    "content": "parts",
    "parts": {
      "summary": {
        "selector": "summary",
        "description": "Overskriften brukeren trykker på for å åpne og lukke. En `<h2>` til `<h6>` inni gir den et nivå i dokumentet.",
        "content": "free"
      },
      "content": {
        "selector": ".lt-accordion__content",
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
  "lt-accordion__content": {
    "component": "accordion",
    "title": "Accordion",
    "description": "Panel som kan foldes ut, bygget på details og summary. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/accordion/",
    "content": "free",
    "partOf": "lt-accordion",
    "attributes": {}
  },
  "lt-alert": {
    "component": "alert",
    "title": "Alert",
    "description": "Melding som gjelder hele siden eller hele skjemaet. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/alert/",
    "content": "free",
    "parts": {
      "title": {
        "selector": ".lt-alert__title",
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
  "lt-alert__title": {
    "component": "alert",
    "title": "Alert",
    "description": "Melding som gjelder hele siden eller hele skjemaet. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/alert/",
    "content": "text",
    "partOf": "lt-alert",
    "attributes": {}
  },
  "lt-avatar": {
    "component": "avatar",
    "title": "Avatar",
    "description": "Profilbilde eller initialer. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/avatar/",
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
  "lt-avatar-stack": {
    "component": "avatar",
    "title": "Avatar",
    "description": "Profilbilde eller initialer. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/avatar/",
    "content": "parts",
    "parts": {
      "item": {
        "selector": "li",
        "description": "Ett listepunkt per person.",
        "content": "parts",
        "multiple": true
      },
      "avatar": {
        "selector": "li > .lt-avatar",
        "description": "Avataren i hvert listepunkt.",
        "content": "free",
        "multiple": true
      }
    },
    "attributes": {}
  },
  "lt-badge": {
    "component": "badge",
    "title": "Badge",
    "description": "Kompakt statusmerke. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/badge/",
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
  "lt-breadcrumbs": {
    "component": "breadcrumbs",
    "title": "Breadcrumbs",
    "description": "Brødsmulesti som viser hvor på siden brukeren er. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/breadcrumbs/",
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
  "lt-button": {
    "component": "button",
    "title": "Button",
    "description": "Knapp for handlinger. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/button/",
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
  "lt-card": {
    "component": "card",
    "title": "Card",
    "description": "Boks som samler innhold som hører sammen. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/card/",
    "content": "free",
    "parts": {
      "title": {
        "selector": ".lt-card__title",
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
  "lt-card__title": {
    "component": "card",
    "title": "Card",
    "description": "Boks som samler innhold som hører sammen. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/card/",
    "content": "text",
    "partOf": "lt-card",
    "attributes": {}
  },
  "lt-checkbox": {
    "component": "checkbox",
    "title": "Checkbox",
    "description": "Avkryssingsboks for valg som står for seg selv. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/checkbox/",
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
  "lt-checkbox-row": {
    "component": "checkbox",
    "title": "Checkbox",
    "description": "Avkryssingsboks for valg som står for seg selv. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/checkbox/",
    "content": "parts",
    "parts": {
      "control": {
        "selector": "input[type='checkbox']",
        "description": "Avkryssingsboksen, med klassen sin.",
        "content": "none",
        "unique": true
      },
      "label": {
        "selector": "label",
        "description": "Ledeteksten, koblet til kontrollen med `for`.",
        "content": "text"
      }
    },
    "attributes": {}
  },
  "lt-divider": {
    "component": "divider",
    "title": "Divider",
    "description": "Skillelinje mellom deler av innholdet. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/divider/",
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
  "lt-error-text": {
    "component": "error-text",
    "title": "Error Text",
    "description": "Feilmelding under et skjemafelt. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/error-text/",
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
  "lt-fieldset": {
    "component": "fieldset",
    "title": "Fieldset",
    "description": "Gruppe av kontroller med en felles ledetekst. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/fieldset/",
    "content": "free",
    "parts": {
      "legend": {
        "selector": "> .lt-legend",
        "description": "Ledeteksten til gruppen, en `<legend>` med klassen.",
        "content": "text",
        "unique": true
      },
      "help": {
        "selector": ".lt-help-text",
        "description": "Hjelpeteksten til gruppen, koblet med `aria-describedby` på feltsettet.",
        "content": "text",
        "optional": true
      },
      "error": {
        "selector": ".lt-error-text",
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
  "lt-legend": {
    "component": "fieldset",
    "title": "Fieldset",
    "description": "Gruppe av kontroller med en felles ledetekst. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/fieldset/",
    "content": "text",
    "partOf": "lt-fieldset",
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
  "lt-file-upload": {
    "component": "file-upload",
    "title": "File Upload",
    "description": "Felt for opplasting av filer. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/file-upload/",
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
  "lt-file-upload-list": {
    "component": "file-upload",
    "title": "File Upload",
    "description": "Felt for opplasting av filer. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/file-upload/",
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
  "lt-heading": {
    "component": "heading",
    "title": "Heading",
    "description": "Overskrifter i seks størrelser, uavhengig av nivå. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/heading/",
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
  "lt-help-text": {
    "component": "help-text",
    "title": "Help Text",
    "description": "Forklarende tekst under et skjemafelt. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/help-text/",
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
  "lt-icon": {
    "component": "icon",
    "title": "Icon",
    "description": "Ikon fra appens eget sett, like stort som teksten rundt. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/icon/",
    "content": "none",
    "attributes": {}
  },
  "lt-input": {
    "component": "input",
    "title": "Input",
    "description": "Tekstfelt for skjema, med tilstander for gyldig og ugyldig. CSS-komponent.",
    "link": "https://lo-tek.sobernetics.no/components/input/",
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
  "lt-label": {
    "component": "label",
    "title": "Label",
    "description": "Ledetekst for skjemafelt, med markering av påkrevd og valgfritt. CSS-komponent.",
    "link": "https://lo-tek.sobernetics.no/components/label/",
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
  "lt-link": {
    "component": "link",
    "title": "Link",
    "description": "Lenkestil for navigasjon i løpende tekst. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/link/",
    "content": "text",
    "attributes": {}
  },
  "lt-list": {
    "component": "list",
    "title": "List",
    "description": "Punktliste, nummerert liste og lister uten punkter. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/list/",
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
  "lt-pagination": {
    "component": "pagination",
    "title": "Pagination",
    "description": "Sidenavigering for lange lister. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/pagination/",
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
        "selector": ".lt-pagination__gap",
        "description": "Hullet der sider er utelatt.",
        "content": "text",
        "multiple": true,
        "optional": true
      }
    },
    "attributes": {}
  },
  "lt-pagination__gap": {
    "component": "pagination",
    "title": "Pagination",
    "description": "Sidenavigering for lange lister. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/pagination/",
    "content": "text",
    "partOf": "lt-pagination",
    "attributes": {}
  },
  "lt-paragraph": {
    "component": "paragraph",
    "title": "Paragraph",
    "description": "Brødtekst og ingress med begrenset linjelengde. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/paragraph/",
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
  "lt-progress": {
    "component": "progress",
    "title": "Progress",
    "description": "Framdriftsstolpe for noe som har en ende. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/progress/",
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
  "lt-radio": {
    "component": "radio",
    "title": "Radio",
    "description": "Radioknapper for ett valg blant flere. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/radio/",
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
  "lt-radio-row": {
    "component": "radio",
    "title": "Radio",
    "description": "Radioknapper for ett valg blant flere. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/radio/",
    "content": "parts",
    "parts": {
      "control": {
        "selector": "input[type='radio']",
        "description": "Radioknappen, med klassen sin.",
        "content": "none",
        "unique": true
      },
      "label": {
        "selector": "label",
        "description": "Ledeteksten, koblet til kontrollen med `for`.",
        "content": "text"
      }
    },
    "attributes": {}
  },
  "lt-search": {
    "component": "search",
    "title": "Search",
    "description": "Søkefelt med forstørrelsesglass. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/search/",
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
  "lt-search-row": {
    "component": "search",
    "title": "Search",
    "description": "Søkefelt med forstørrelsesglass. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/search/",
    "content": "parts",
    "parts": {
      "label": {
        "selector": "label",
        "description": "Ledeteksten, koblet med `for`. Gjerne skjult med `lt-sr-only`.",
        "content": "text"
      },
      "control": {
        "selector": "input[type='search']",
        "description": "Søkefeltet, med klassene `lt-input lt-search`.",
        "content": "none",
        "unique": true
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
  "lt-select": {
    "component": "select",
    "title": "Select",
    "description": "Nedtrekksliste. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/select/",
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
  "lt-skeleton": {
    "component": "skeleton",
    "title": "Skeleton",
    "description": "Plassholder som viser formen på innhold som lastes. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/skeleton/",
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
  "lt-skip-link": {
    "component": "skip-link",
    "title": "Skip Link",
    "description": "Lenke som hopper forbi menyen til hovedinnholdet. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/skip-link/",
    "content": "text",
    "attributes": {}
  },
  "lt-spinner": {
    "component": "spinner",
    "title": "Spinner",
    "description": "Venteindikator for noe som pågår. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/spinner/",
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
  "lt-sr-only": {
    "component": "sr-only",
    "title": "Sr Only",
    "description": "Tekst som bare skjermlesere får. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/sr-only/",
    "content": "text",
    "attributes": {}
  },
  "lt-switch": {
    "component": "switch",
    "title": "Switch",
    "description": "Bryter for en innstilling som slår inn med en gang. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/switch/",
    "content": "none",
    "attributes": {}
  },
  "lt-switch-row": {
    "component": "switch",
    "title": "Switch",
    "description": "Bryter for en innstilling som slår inn med en gang. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/switch/",
    "content": "parts",
    "parts": {
      "control": {
        "selector": "input[role='switch']",
        "description": "Bryteren, med klassen sin.",
        "content": "none",
        "unique": true
      },
      "label": {
        "selector": "label",
        "description": "Ledeteksten, koblet til kontrollen med `for`.",
        "content": "text"
      }
    },
    "attributes": {}
  },
  "lt-table": {
    "component": "table",
    "title": "Table",
    "description": "Tabell for data i rader og kolonner. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/table/",
    "content": "parts",
    "parts": {
      "caption": {
        "selector": "> caption",
        "description": "Tabellens navn.",
        "content": "text",
        "unique": true,
        "optional": true
      },
      "head": {
        "selector": "> thead",
        "description": "Overskriftsraden, med `<th scope=\"col\">` per kolonne.",
        "content": "free",
        "unique": true
      },
      "body": {
        "selector": "tbody",
        "description": "Radene, i én eller flere grupper. En `<th scope=\"row\">` først i raden gir raden et navn.",
        "content": "free",
        "multiple": true
      },
      "sort": {
        "selector": "th > .lt-table__sort",
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
  "lt-table__sort": {
    "component": "table",
    "title": "Table",
    "description": "Tabell for data i rader og kolonner. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/table/",
    "content": "text",
    "partOf": "lt-table",
    "attributes": {}
  },
  "lt-table-scroll": {
    "component": "table",
    "title": "Table",
    "description": "Tabell for data i rader og kolonner. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/table/",
    "content": "parts",
    "parts": {
      "table": {
        "selector": ".lt-table",
        "description": "Tabellen som kan rulles sidelengs.",
        "content": "free"
      }
    },
    "attributes": {}
  },
  "lt-tag": {
    "component": "tag",
    "title": "Tag",
    "description": "Merkelapp for emneord og filtre. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/tag/",
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
  "lt-textarea": {
    "component": "textarea",
    "title": "Textarea",
    "description": "Flerlinjet tekstfelt. CSS-komponent med én klasse og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/textarea/",
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
  "lt-toggle-group": {
    "component": "toggle-group",
    "title": "Toggle Group",
    "description": "Gruppe der ett alternativ er valgt om gangen. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/toggle-group/",
    "content": "parts",
    "parts": {
      "legend": {
        "selector": "> legend",
        "description": "Hva alternativene velger mellom. Kan skjules med `lt-sr-only`, men må stå der.",
        "content": "text",
        "unique": true
      },
      "option": {
        "selector": ".lt-toggle-group__option",
        "description": "Ett alternativ: en `<label>` med radioknappen og teksten.",
        "content": "free",
        "multiple": true
      },
      "radio": {
        "selector": ".lt-toggle-group__option > input[type='radio']",
        "description": "Radioknappen i hvert alternativ, med samme `name`.",
        "content": "none",
        "multiple": true
      }
    },
    "attributes": {}
  },
  "lt-toggle-group__option": {
    "component": "toggle-group",
    "title": "Toggle Group",
    "description": "Gruppe der ett alternativ er valgt om gangen. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/toggle-group/",
    "content": "free",
    "partOf": "lt-toggle-group",
    "attributes": {}
  },
  "lt-tooltip": {
    "component": "tooltip",
    "title": "Tooltip",
    "description": "Liten hjelpetekst som vises på hover og fokus. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/tooltip/",
    "content": "parts",
    "parts": {
      "trigger": {
        "selector": "[aria-describedby]",
        "description": "Elementet boblen beskriver, med `aria-describedby` mot boblens id.",
        "content": "text"
      },
      "bubble": {
        "selector": ".lt-tooltip__bubble",
        "description": "Boblen, med `role=\"tooltip\"` og id-en.",
        "content": "text"
      }
    },
    "attributes": {}
  },
  "lt-tooltip__bubble": {
    "component": "tooltip",
    "title": "Tooltip",
    "description": "Liten hjelpetekst som vises på hover og fokus. CSS-komponent med to klasser og ingen JavaScript.",
    "link": "https://lo-tek.sobernetics.no/components/tooltip/",
    "content": "text",
    "partOf": "lt-tooltip",
    "attributes": {}
  },
  "lt-dialog": {
    "component": "dialog",
    "title": "Dialog",
    "description": "Modal dialog bygget på det native dialog-elementet. Seks klasser og ingen JavaScript, med en valgfri komponent for servere som ikke kan kalle showModal().",
    "link": "https://lo-tek.sobernetics.no/components/dialog/",
    "content": "free",
    "parts": {
      "header": {
        "selector": ".lt-dialog__header",
        "description": "Toppen, med overskriften og underteksten. `data-color` på dialogen farger den.",
        "content": "parts",
        "optional": true
      },
      "title": {
        "selector": ".lt-dialog__title",
        "description": "Overskriften, som `aria-labelledby` peker på.",
        "content": "text",
        "optional": true
      },
      "subtitle": {
        "selector": ".lt-dialog__subtitle",
        "description": "Linja under overskriften, inne i toppen.",
        "content": "text",
        "optional": true
      },
      "body": {
        "selector": ".lt-dialog__body",
        "description": "Innholdet, som ruller når dialogen blir for høy. Må være et direkte barn.",
        "content": "free",
        "optional": true
      },
      "footer": {
        "selector": ".lt-dialog__footer",
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
  "lt-dialog__body": {
    "component": "dialog",
    "title": "Dialog",
    "description": "Modal dialog bygget på det native dialog-elementet. Seks klasser og ingen JavaScript, med en valgfri komponent for servere som ikke kan kalle showModal().",
    "link": "https://lo-tek.sobernetics.no/components/dialog/",
    "content": "free",
    "partOf": "lt-dialog",
    "attributes": {}
  },
  "lt-dialog__title": {
    "component": "dialog",
    "title": "Dialog",
    "description": "Modal dialog bygget på det native dialog-elementet. Seks klasser og ingen JavaScript, med en valgfri komponent for servere som ikke kan kalle showModal().",
    "link": "https://lo-tek.sobernetics.no/components/dialog/",
    "content": "text",
    "partOf": "lt-dialog",
    "attributes": {}
  },
  "lt-dialog__footer": {
    "component": "dialog",
    "title": "Dialog",
    "description": "Modal dialog bygget på det native dialog-elementet. Seks klasser og ingen JavaScript, med en valgfri komponent for servere som ikke kan kalle showModal().",
    "link": "https://lo-tek.sobernetics.no/components/dialog/",
    "content": "free",
    "partOf": "lt-dialog",
    "attributes": {}
  },
  "lt-dialog__header": {
    "component": "dialog",
    "title": "Dialog",
    "description": "Modal dialog bygget på det native dialog-elementet. Seks klasser og ingen JavaScript, med en valgfri komponent for servere som ikke kan kalle showModal().",
    "link": "https://lo-tek.sobernetics.no/components/dialog/",
    "content": "parts",
    "partOf": "lt-dialog",
    "parts": {
      "title": {
        "selector": ".lt-dialog__title",
        "description": "Overskriften.",
        "content": "text"
      },
      "subtitle": {
        "selector": ".lt-dialog__subtitle",
        "description": "Linja under overskriften.",
        "content": "text",
        "optional": true
      }
    },
    "attributes": {}
  },
  "lt-dialog__subtitle": {
    "component": "dialog",
    "title": "Dialog",
    "description": "Modal dialog bygget på det native dialog-elementet. Seks klasser og ingen JavaScript, med en valgfri komponent for servere som ikke kan kalle showModal().",
    "link": "https://lo-tek.sobernetics.no/components/dialog/",
    "content": "text",
    "partOf": "lt-dialog",
    "attributes": {}
  },
  "lt-error-summary": {
    "component": "error-summary",
    "title": "Error Summary",
    "description": "Samler feilene i et skjema og sender brukeren til feltet som feilet. Rammekomponent.",
    "link": "https://lo-tek.sobernetics.no/components/error-summary/",
    "content": "parts",
    "parts": {
      "title": {
        "selector": ".lt-error-summary__title",
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
  "lt-error-summary__title": {
    "component": "error-summary",
    "title": "Error Summary",
    "description": "Samler feilene i et skjema og sender brukeren til feltet som feilet. Rammekomponent.",
    "link": "https://lo-tek.sobernetics.no/components/error-summary/",
    "content": "text",
    "partOf": "lt-error-summary",
    "attributes": {}
  },
  "lt-popover": {
    "component": "popover",
    "title": "Popover",
    "description": "Panel som henger under en knapp og lukker seg selv. Rammekomponent.",
    "link": "https://lo-tek.sobernetics.no/components/popover/",
    "content": "free",
    "attributes": {}
  },
  "lt-session-timeout": {
    "component": "session-timeout",
    "title": "Session Timeout",
    "description": "Varsler før en innlogget økt går ut, og teller ned. Du skriver dialogen, komponenten tar tiden.",
    "link": "https://lo-tek.sobernetics.no/components/session-timeout/",
    "content": "parts",
    "parts": {
      "dialog": {
        "selector": ".lt-session-timeout__dialog",
        "description": "Dialogen med varselet, med `role=\"alertdialog\"`.",
        "content": "parts"
      },
      "title": {
        "selector": ".lt-session-timeout__title",
        "description": "Overskriften i dialogen.",
        "content": "text",
        "optional": true
      },
      "text": {
        "selector": ".lt-session-timeout__text",
        "description": "Avsnittet med tiden som er igjen.",
        "content": "text"
      },
      "count": {
        "selector": ".lt-session-timeout__count",
        "description": "Tallet som telles ned, inne i avsnittet. Komponenten fyller det.",
        "content": "none"
      },
      "status": {
        "selector": "[role='status']",
        "description": "Opplesningen. Står tomt, og komponenten fyller det.",
        "content": "none"
      },
      "actions": {
        "selector": ".lt-session-timeout__actions",
        "description": "Knapperaden, et `<form method=\"dialog\">`.",
        "content": "parts"
      },
      "button": {
        "selector": ".lt-session-timeout__actions button",
        "description": "Knappene som forlenger økten eller logger ut.",
        "content": "text",
        "multiple": true
      }
    },
    "attributes": {}
  },
  "lt-session-timeout__dialog": {
    "component": "session-timeout",
    "title": "Session Timeout",
    "description": "Varsler før en innlogget økt går ut, og teller ned. Du skriver dialogen, komponenten tar tiden.",
    "link": "https://lo-tek.sobernetics.no/components/session-timeout/",
    "content": "parts",
    "partOf": "lt-session-timeout",
    "parts": {
      "title": {
        "selector": ".lt-session-timeout__title",
        "description": "Overskriften.",
        "content": "text",
        "optional": true
      },
      "text": {
        "selector": ".lt-session-timeout__text",
        "description": "Avsnittet med tiden som er igjen.",
        "content": "text"
      },
      "count": {
        "selector": ".lt-session-timeout__count",
        "description": "Tallet som telles ned, inne i avsnittet.",
        "content": "none"
      },
      "status": {
        "selector": "[role='status']",
        "description": "Opplesningen, som komponenten fyller.",
        "content": "none"
      },
      "actions": {
        "selector": ".lt-session-timeout__actions",
        "description": "Knapperaden, et `<form method=\"dialog\">`.",
        "content": "parts"
      }
    },
    "attributes": {}
  },
  "lt-session-timeout__title": {
    "component": "session-timeout",
    "title": "Session Timeout",
    "description": "Varsler før en innlogget økt går ut, og teller ned. Du skriver dialogen, komponenten tar tiden.",
    "link": "https://lo-tek.sobernetics.no/components/session-timeout/",
    "content": "text",
    "partOf": "lt-session-timeout",
    "attributes": {}
  },
  "lt-session-timeout__text": {
    "component": "session-timeout",
    "title": "Session Timeout",
    "description": "Varsler før en innlogget økt går ut, og teller ned. Du skriver dialogen, komponenten tar tiden.",
    "link": "https://lo-tek.sobernetics.no/components/session-timeout/",
    "content": "text",
    "partOf": "lt-session-timeout",
    "attributes": {}
  },
  "lt-session-timeout__count": {
    "component": "session-timeout",
    "title": "Session Timeout",
    "description": "Varsler før en innlogget økt går ut, og teller ned. Du skriver dialogen, komponenten tar tiden.",
    "link": "https://lo-tek.sobernetics.no/components/session-timeout/",
    "content": "none",
    "partOf": "lt-session-timeout",
    "attributes": {}
  },
  "lt-session-timeout__actions": {
    "component": "session-timeout",
    "title": "Session Timeout",
    "description": "Varsler før en innlogget økt går ut, og teller ned. Du skriver dialogen, komponenten tar tiden.",
    "link": "https://lo-tek.sobernetics.no/components/session-timeout/",
    "content": "parts",
    "partOf": "lt-session-timeout",
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
  "lt-suggestion__list": {
    "component": "suggestion",
    "title": "Suggestion",
    "description": "Felt med forslagsliste som snevrer seg inn mens brukeren skriver. Rammekomponent.",
    "link": "https://lo-tek.sobernetics.no/components/suggestion/",
    "content": "parts",
    "parts": {
      "option": {
        "selector": "[role='option'], .lt-suggestion__option, > li:not([role])",
        "description": "Ett forslag: rollen eller klassen når de står der, ellers en `<li>` uten rolle, som komponenten gir klassen og rollen. Lista kan stå tom til serveren fyller den.",
        "content": "text",
        "multiple": true,
        "optional": true
      }
    },
    "attributes": {}
  },
  "lt-suggestion__option": {
    "component": "suggestion",
    "title": "Suggestion",
    "description": "Felt med forslagsliste som snevrer seg inn mens brukeren skriver. Rammekomponent.",
    "link": "https://lo-tek.sobernetics.no/components/suggestion/",
    "content": "text",
    "partOf": "lt-suggestion__list",
    "attributes": {}
  },
  "lt-suggestion__value": {
    "component": "suggestion",
    "title": "Suggestion",
    "description": "Felt med forslagsliste som snevrer seg inn mens brukeren skriver. Rammekomponent.",
    "link": "https://lo-tek.sobernetics.no/components/suggestion/",
    "content": "none",
    "attributes": {}
  },
  "lt-suggestion__empty": {
    "component": "suggestion",
    "title": "Suggestion",
    "description": "Felt med forslagsliste som snevrer seg inn mens brukeren skriver. Rammekomponent.",
    "link": "https://lo-tek.sobernetics.no/components/suggestion/",
    "content": "text",
    "attributes": {}
  },
  "lt-tabs__list": {
    "component": "tabs",
    "title": "Tabs",
    "description": "Fanerad av lenker til panelene sine. Rammekomponent.",
    "link": "https://lo-tek.sobernetics.no/components/tabs/",
    "content": "free",
    "parts": {
      "tab": {
        "selector": "a[role='tab'][href^='#'], a[href^='#']:not([role])",
        "description": "En fane: en lenke til panelet sitt, som `<a href=\"#vedlegg\">`. Har serveren skrevet `role=\"tab\"`, er bare lenkene med rollen faner, og raden kan ha andre lenker. `role=\"tab\"` på noe som ikke er en lenke, er ikke en fane.",
        "content": "text",
        "multiple": true
      }
    },
    "attributes": {}
  },
  "lt-tabs__panel": {
    "component": "tabs",
    "title": "Tabs",
    "description": "Fanerad av lenker til panelene sine. Rammekomponent.",
    "link": "https://lo-tek.sobernetics.no/components/tabs/",
    "content": "free",
    "attributes": {}
  },
  "lt-connection-status": {
    "component": "connection-status",
    "title": "Connection Status",
    "description": "Sier fra når forbindelsen til serveren er borte. Frittstående komponent.",
    "link": "https://lo-tek.sobernetics.no/components/connection-status/",
    "content": "none",
    "attributes": {}
  },
  "lt-connection-status__bar": {
    "component": "connection-status",
    "title": "Connection Status",
    "description": "Sier fra når forbindelsen til serveren er borte. Frittstående komponent.",
    "link": "https://lo-tek.sobernetics.no/components/connection-status/",
    "content": "text",
    "attributes": {}
  },
  "lt-toast": {
    "component": "toast",
    "title": "Toast",
    "description": "Kø av korte meldinger i hjørnet av skjermen. Frittstående komponent.",
    "link": "https://lo-tek.sobernetics.no/components/toast/",
    "content": "none",
    "attributes": {}
  },
  "lt-toast__message": {
    "component": "toast",
    "title": "Toast",
    "description": "Kø av korte meldinger i hjørnet av skjermen. Frittstående komponent.",
    "link": "https://lo-tek.sobernetics.no/components/toast/",
    "content": "free",
    "attributes": {}
  },
  "lt-toast__close": {
    "component": "toast",
    "title": "Toast",
    "description": "Kø av korte meldinger i hjørnet av skjermen. Frittstående komponent.",
    "link": "https://lo-tek.sobernetics.no/components/toast/",
    "content": "text",
    "attributes": {}
  },
  "lt-theme-control": {
    "component": "tilpasning",
    "title": "Tilpasning",
    "description": "Endre farger, form og størrelse i LO-TEK uten at endringene forsvinner ved neste oppgradering.",
    "link": "https://lo-tek.sobernetics.no/customising/",
    "content": "none",
    "attributes": {}
  }
}
