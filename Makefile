.PHONY: setup run-backend run-frontend run docker-run clean

setup:
	@bash scripts/setup.sh

run-backend:
	@bash scripts/start_backend.sh

run-frontend:
	@bash scripts/start_frontend.sh

run:
	@echo "Running both frontend (port 3000) and backend (port 8000) concurrently..."
	@make -j 2 run-backend run-frontend

docker-run:
	@echo "Launching via docker compose..."
	docker compose up --build

clean:
	@echo "Cleaning up generated assets, caches, and node packages..."
	rm -rf backend/.venv backend/uploads/* backend/processed/* backend/data/*.json
	rm -rf frontend/node_modules frontend/.next
