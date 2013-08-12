SPRITE_ROOT=src/img/sprites

all: jshint sprites build/wdl-viewer.css

clean:
	rm -rf build/wdl-viewer.*

jshint:
	jshint src/js/wdl-viewer.js

tidy:
	tidy-html5 -utf8 -m -quiet --tidy-mark no --wrap 0 --indent yes --indent-spaces 4 examples/*.html

sprites:
	mkdir -p ${SPRITE_ROOT}/seadragon-controls/
	for f in external/openseadragon/images/*_{rest,hover,pressed}.png; do \
		DEST_FILE=$${f##*/}; \
		DEST_FILE=$${DEST_FILE/_rest/}; \
		DEST_FILE=$${DEST_FILE/_pressed/_active}; \
		ln -f $$f ${SPRITE_ROOT}/seadragon-controls/$${DEST_FILE}; \
	done
	compass compile

build/wdl-viewer.css:
	compass compile

runserver:
	python -m SimpleHTTPServer