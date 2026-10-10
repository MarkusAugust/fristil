// Generert av editor/scripts/generate.ts. Ikke rediger.
import type { Elements } from "./types.js"

export const elements: Elements = {
  "fs-field": {
    "link": "https://fristil.sobernetics.no/components/field/",
    "attributes": {
      "invalid": {
        "type": "flag"
      },
      "disabled": {
        "type": "flag"
      },
      "optional": {
        "type": "flag"
      },
      "required-marker": {
        "type": "values",
        "values": [
          "symbol",
          "text",
          "none"
        ]
      },
      "control-id": {
        "type": "text"
      },
      "described-by": {
        "type": "text"
      }
    }
  },
  "fs-tabs": {
    "link": "https://fristil.sobernetics.no/components/tabs/",
    "attributes": {
      "server-controlled": {
        "type": "flag"
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
    "attributes": {
      "data-autofocus": {
        "type": "values",
        "values": [
          "false",
          "true"
        ]
      },
      "hidden": {
        "type": "flag"
      }
    }
  },
  "fs-popover": {
    "link": "https://fristil.sobernetics.no/components/popover/",
    "attributes": {
      "open": {
        "type": "flag"
      },
      "placement": {
        "type": "values",
        "values": [
          "bottom-start",
          "bottom-end",
          "top-start",
          "top-end"
        ]
      },
      "server-controlled": {
        "type": "flag"
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
    "attributes": {
      "prefiltered": {
        "type": "flag"
      },
      "count-none": {
        "type": "text"
      },
      "count-zero": {
        "type": "text"
      },
      "count-one": {
        "type": "text"
      },
      "count-two": {
        "type": "text"
      },
      "count-few": {
        "type": "text"
      },
      "count-many": {
        "type": "text"
      },
      "count-other": {
        "type": "text"
      },
      "server-controlled": {
        "type": "flag"
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
    "attributes": {
      "open": {
        "type": "flag"
      },
      "server-controlled": {
        "type": "flag"
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
    "attributes": {
      "duration": {
        "type": "number"
      },
      "label": {
        "type": "text"
      },
      "close-label": {
        "type": "text"
      }
    },
    "events": {
      "toast-dismiss": {}
    }
  },
  "fs-session-timeout": {
    "link": "https://fristil.sobernetics.no/components/session-timeout/",
    "attributes": {
      "warn-at": {
        "type": "number"
      },
      "expires-at": {
        "type": "number"
      },
      "activity-interval": {
        "type": "number"
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
    "attributes": {
      "offline-text": {
        "type": "text"
      },
      "online-text": {
        "type": "text"
      }
    },
    "events": {
      "connection-lost": {},
      "connection-restored": {}
    }
  }
}
