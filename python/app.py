from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI(
    title="Carina ML Engine",
    description="Python ML service for Carina AI property intelligence platform.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "carina-python", "version": "0.1.0"}


@app.get("/")
def root():
    return {"message": "Carina ML Engine. See /docs for API reference."}
