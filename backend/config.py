import os
from dotenv import load_dotenv

# 加载.env文件
load_dotenv()

class Config:
    # 数据库配置
    SQLALCHEMY_DATABASE_URI = f"mysql+pymysql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # 应用配置
    SECRET_KEY = os.getenv('SECRET_KEY')
    
    # 加密配置
    ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY')
    SALT_VALUE = os.getenv('SALT_VALUE')