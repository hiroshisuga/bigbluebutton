# Presenter notes extractor (BBB 4.0)

The presentation popup can show notes from a PPTX uploaded with a presentation. The
BBB web service calls `extract_pptx_notes.py` when a presenter chooses **Extract
notes from uploaded PPTX** or uploads a separate notes PPTX.

On the BBB web server, install the extractor and its Python dependency:

```sh
sudo apt install python3-defusedxml (if not installed)
sudo install -m 755 bigbluebutton-web/script/extract_pptx_notes.py /usr/local/bin/extract_pptx_notes.py
```

Deploy the modified `bbb-web` application, the `bbb-graphql-server` schema view,
and the HTML5 client. Ensure the Nginx configuration includes the new
`/bigbluebutton/presentation-notes/upload` location in `bbb-web.nginx`. Set
`public.presentation.allowPopupPresentation: true` in the HTML5 client settings
to expose the menu item to presenters. The flag defaults to `false`.

The client code assumes a tldraw build containing the cross-window fixes. Replace
the local tldraw package with that build (for example via yalc) before building
the HTML5 client. No global DOM or animation APIs are overridden by this patch.

Check the presentation menu in a live meeting: detach and reattach the popup,
resize it, use fullscreen, move between slides, and verify that only a presenter
or moderator can request the `/notes/N` URL. Also try a PPTX with hidden slides
and, if animation expansion is used, its expanded version.
