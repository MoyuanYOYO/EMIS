# backend/utils/decorators.py - 权限装饰器
from functools import wraps
from flask import session, jsonify, redirect, request

def login_required(f):
    """要求用户登录的装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({'error': '需要登录'}), 401
            return redirect('/auth/test-login')
        return f(*args, **kwargs)
    return decorated_function

def role_required(*roles):
    """要求特定角色的装饰器"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'user_id' not in session:
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return jsonify({'error': '需要登录'}), 401
                return redirect('/auth/test-login')
            
            if session.get('role') not in roles:
                return jsonify({'error': '权限不足'}), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def student_only(f):
    """仅学生可访问"""
    return role_required('student')(f)

def teacher_only(f):
    """仅教师可访问"""
    return role_required('teacher')(f)

def admin_only(f):
    """仅管理员可访问"""
    return role_required('admin')(f)