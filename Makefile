BASE_PATH=$(PWD)
COMPOSE_FILE=./docker/docker-compose.yml

NAME=sticky-notes-app-development
NAME_staging=sticky-notes-app-staging

all: 
	@echo 
	@echo "please specify the command 👊"
	@echo

encrypt-envs:
	@echo "🚀 Encrypting ENVS 🚀"
	@chmod +x ./scripts/encrypt-envs.sh
	@./scripts/encrypt-envs.sh .env.development $(PASSPHRASE_DEVELOPMENT) development
	@./scripts/encrypt-envs.sh .env.staging $(PASSPHRASE_STAGING) staging
	@./scripts/encrypt-envs.sh .env.production $(PASSPHRASE_PRODUCTION) production

decrypt-envs:
	@echo "🚀 Decrypting ENVS 🚀"
	@chmod +x ./scripts/decrypt-envs.sh
	@./scripts/decrypt-envs.sh .env.development $(PASSPHRASE_DEVELOPMENT) development
	@./scripts/decrypt-envs.sh .env.staging $(PASSPHRASE_STAGING) staging
	@./scripts/decrypt-envs.sh .env.production $(PASSPHRASE_PRODUCTION) production

create-env-stage:
	@echo
	@echo "🚀Moving secrets of $(stage) to .env"
	@echo
	@chmod +x ./scripts/create-env.sh
	@./scripts/create-env.sh "$(PWD)" "$(stage)"

deploy:
	@echo
	@echo "🏭Building & 🚀Deploying development services"
	@echo
	docker compose --env-file docker/.env -f docker/docker-compose.yml up -d

delete:
	@echo
	@echo "🏭Building & 🚀Deploying development services"
	@echo
	docker compose --env-file docker/.env -f docker/docker-compose.yml down -v

recreate:
	@echo
	@echo "🚀  Recreating $(stage) services"
	@echo "🗑️  Deleting $(stage) services"
	@$(MAKE) --no-print-directory delete
	@$(MAKE) --no-print-directory decrypt-envs
	@$(MAKE) --no-print-directory create-env-stage
	@echo
	@$(MAKE) --no-print-directory deploy
	pnpm --filter api run db:generate
	pnpm --filter api run db:migrate
	pnpm --filter api run db:seed
	@echo "✅ $(stage) services recreated successfully"

