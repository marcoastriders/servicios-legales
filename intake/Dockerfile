FROM python:3.12-alpine
WORKDIR /app
COPY server.py .
EXPOSE 8000
HEALTHCHECK --interval=60s CMD wget -qO- http://127.0.0.1:8000/health || exit 1
CMD ["python", "server.py"]
