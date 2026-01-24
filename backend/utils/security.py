# backend/utils/security.py - 安全工具
import bcrypt
from cryptography.fernet import Fernet
import hashlib
import base64
from backend.config import Config

class SecurityUtils:
    @staticmethod
    def hash_password(password):
        """使用bcrypt加密密码"""
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
        return hashed.decode('utf-8')
    
    @staticmethod
    def check_password(password, hashed_password):
        """验证密码"""
        return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))
    
    @staticmethod
    def encrypt_data(data):
        """AES加密敏感数据"""
        if not data:
            return None
        key = Config.ENCRYPTION_KEY.encode()
        cipher = Fernet(key)
        encrypted = cipher.encrypt(data.encode())
        return base64.b64encode(encrypted).decode('utf-8')
    
    @staticmethod
    def decrypt_data(encrypted_data):
        """AES解密敏感数据"""
        if not encrypted_data:
            return None
        key = Config.ENCRYPTION_KEY.encode()
        cipher = Fernet(key)
        decoded = base64.b64decode(encrypted_data)
        decrypted = cipher.decrypt(decoded)
        return decrypted.decode('utf-8')
    
    @staticmethod
    def calculate_grade_hash(student_id, course_id, grade):
        """计算成绩哈希值用于完整性校验"""
        if grade is None:
            return None
        
        salt = Config.SALT_VALUE
        data = f"{student_id}{course_id}{grade}{salt}"
        return hashlib.sha256(data.encode()).hexdigest()
    
    @staticmethod
    def verify_grade_hash(student_id, course_id, grade, stored_hash):
        """验证成绩完整性"""
        if grade is None or stored_hash is None:
            return False
        
        calculated_hash = SecurityUtils.calculate_grade_hash(student_id, course_id, grade)
        return calculated_hash == stored_hash