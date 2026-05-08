FROM python:3.12-slim
WORKDIR /app
COPY . /app
RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; else echo "No requirements.txt – skipping pip install"; fi
EXPOSE 8080
CMD ["python", "cockpit.py"]
