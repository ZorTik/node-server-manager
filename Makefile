.PHONY: build test up down restart logs shell ps

ATTACH ?= 0

all: build

build:
	docker compose build

test:
ifeq ($(ATTACH),1) # if ATTACH=1, run tests with debugger attached
	docker compose run --rm -p 9229:9229 nsm \
            		sh -c 'npm run migrate && node --inspect-brk=0.0.0.0:9229 ./node_modules/.bin/jest --runInBand $(ARGS)'
else
	docker compose run --rm nsm npm run test $(ARGS)
endif

up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f

shell:
	docker compose exec nsm sh

ps:
	docker compose ps
