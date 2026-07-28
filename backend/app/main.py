from fastapi import FastAPI
from sqlalchemy import text

from app.database import engine

app = FastAPI(title="Citizen Pulse AI")


@app.get("/")
def home():
    return {"message": "Backend Running"}


@app.get("/db-test")
def db_test():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"status": "Database Connected Successfully"}
    except Exception as e:
        return {"status": "Connection Failed", "error": str(e)}