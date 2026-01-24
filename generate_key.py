# generate_key.py - 生成加密密钥
from cryptography.fernet import Fernet
import base64

# 生成AES加密密钥
key = Fernet.generate_key()
print("生成的加密密钥:")
print(f"ENCRYPTION_KEY={key.decode()}")

# 生成用于密码哈希的盐
import secrets
salt = secrets.token_hex(16)
print(f"\n生成的盐值:")
print(f"SALT_VALUE={salt}")

# 生成Flask的SECRET_KEY
secret_key = secrets.token_hex(32)
print(f"\n生成的SECRET_KEY:")
print(f"SECRET_KEY={secret_key}")

print("\n请将这些值复制到 .env 文件中")