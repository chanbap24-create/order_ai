import sqlite3
import pandas as pd
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]  # 프로젝트 루트
EXCEL_PATH = BASE / "order-ai.xlsx"         # 파일명이 다르면 여기만 수정
DB_PATH = BASE / "data.sqlite3"
SHEET_NAME = "Client"

# E=4, F=5, G=6, M=12, N=13, Q=16 (0-index)
USECOLS = [4, 5, 6, 12, 13, 16]
NEWCOLS = ["client_name", "client_code", "ship_date", "item_no", "item_name", "unit_price"]

def main():
    if not EXCEL_PATH.exists():
        raise FileNotFoundError(f"엑셀 파일을 못 찾음: {EXCEL_PATH}")

    df = pd.read_excel(EXCEL_PATH, sheet_name=SHEET_NAME, usecols=USECOLS, engine="openpyxl")
    df.columns = NEWCOLS

    df = df.dropna(subset=["client_name", "client_code", "item_no", "item_name"])
    df["client_name"] = df["client_name"].astype(str).str.strip()
    df["client_code"] = df["client_code"].astype(str).str.strip()
    df["item_no"] = df["item_no"].astype(str).str.strip()
    df["item_name"] = df["item_name"].astype(str).str.strip()
    df["ship_date"] = df["ship_date"].astype(str).str.strip()
    df["unit_price"] = pd.to_numeric(df["unit_price"], errors="coerce")

    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    # ✅ 스키마 파일 실행 (없으면 바로 에러나게)
    init_sql_path = BASE / "scripts" / "init_db.sql"
    if not init_sql_path.exists():
        raise FileNotFoundError(f"init_db.sql 없음: {init_sql_path}")

    cur.executescript(init_sql_path.read_text(encoding="utf-8"))

    # ✅ shipments 적재
    df.to_sql("shipments", con, if_exists="append", index=False)
    # ✅ client_alias 적재 (거래처명/코드)
    # 기존 데이터 비우고(중복 방지) 다시 채움
    cur.execute("DELETE FROM client_alias;")

    # df에서 거래처명/코드만 유니크로 뽑아서 넣기
    df_clients = (
        df[["client_code", "client_name"]]
        .dropna()
        .drop_duplicates()
        .copy()
    )
    df_clients.rename(columns={"client_name": "alias"}, inplace=True)
    df_clients["weight"] = 1

    df_clients.to_sql("client_alias", con, if_exists="append", index=False)

    # ✅ stats 테이블이 있는지 확인 (없으면 여기서 멈춤)
    chk = cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='client_item_stats';"
    ).fetchone()
    if not chk:
        raise RuntimeError("client_item_stats 테이블이 스키마에 생성되지 않았습니다. init_db.sql을 확인하세요.")

    # ✅ stats 재생성(데이터 반영 위해 한번 비우고 다시 채움)
    cur.execute("DELETE FROM client_item_stats;")

    cur.execute("""
    INSERT INTO client_item_stats (client_code, item_no, item_name, last_ship_date, buy_count, avg_price)
    SELECT
      client_code,
      item_no,
      MAX(item_name) as item_name,
      MAX(ship_date) as last_ship_date,
      COUNT(*) as buy_count,
      AVG(unit_price) as avg_price
    FROM shipments
    GROUP BY client_code, item_no;
    """)

    con.commit()
    con.close()

    print("✅ DB 생성 완료:", DB_PATH)
    print("✅ shipments rows:", len(df))

if __name__ == "__main__":
    main()
