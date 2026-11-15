FROM python:3.10-slim
WORKDIR /app
COPY . /app
USER 10001:10001
ENV PYTHONUNBUFFERED=1
EXPOSE 8765
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8765/',timeout=3)"
CMD ["python", "run.py", "--host", "0.0.0.0", "--port", "8765", "--strictPort", "--no-browser"]
