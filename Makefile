.PHONY: build test up down restart logs shell ps

all: build

build:
	docker compose build

test:
	docker compose run --rm nsm npm test

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
