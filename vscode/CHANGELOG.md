# Changes in LO-TEK for VS Code

The extension has its own version number. It does not follow the package,
since it only changes when an element or an attribute does.

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
