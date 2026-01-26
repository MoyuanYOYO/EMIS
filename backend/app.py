"""
backend/app.py - Flask主应用
添加静态文件服务功能
"""
import logging
logging.basicConfig(level=logging.DEBUG)
from flask import Flask, send_from_directory, jsonify, session
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
from backend.config import Config
import secrets
import os

# 初始化应用
app = Flask(__name__)
app.config.from_object(Config)

# 设置session密钥（从配置读取）
app.secret_key = app.config.get('SECRET_KEY') or secrets.token_hex(32)

# 初始化数据库
db = SQLAlchemy(app)

# 导入模型（必须在db定义后导入）
from backend import models

# 导入蓝图
from backend.routes.auth import auth_bp
from backend.routes.course import course_bp
from backend.routes.student import student_bp
from backend.routes.teacher import teacher_bp
from backend.routes.admin import admin_bp

# 注册蓝图
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(course_bp, url_prefix='/api/course')
app.register_blueprint(student_bp, url_prefix='/api/student')
app.register_blueprint(teacher_bp, url_prefix='/api/teacher')
app.register_blueprint(admin_bp, url_prefix='/api/admin')

# 导入装饰器
from backend.utils.decorators import login_required, student_only, teacher_only, admin_only

# ==================== 静态文件服务配置 ====================

# 前端文件目录路径
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend')

def serve_frontend_file(filename):
    """提供前端文件"""
    return send_from_directory(FRONTEND_DIR, filename)

def serve_frontend_subdir(subdir, filename):
    """提供前端子目录文件"""
    path = os.path.join(FRONTEND_DIR, subdir)
    return send_from_directory(path, filename)

# ==================== 前端页面路由 ====================

@app.route('/')
def index():
    """主页 - 显示前端主页"""
    return serve_frontend_file('index.html')

@app.route('/student/dashboard')
def student_dashboard_page():
    """学生仪表板页面"""
    if 'user_id' not in session:
        return redirect('/')
    
    if session.get('role') != 'student':
        if session.get('role') == 'teacher':
            return redirect('/teacher/dashboard')
        elif session.get('role') == 'admin':
            return redirect('/admin/dashboard')
    
    return serve_frontend_subdir('pages', 'student-dashboard.html')

# 添加教师和管理员页面的路由（暂时返回简单的重定向）
@app.route('/teacher/dashboard')
def teacher_dashboard_page():
    """教师仪表板页面"""
    # 检查是否已登录，如果未登录则重定向到登录页面
    if 'user_id' not in session:
        return redirect('/')
    
    # 检查角色，如果不是教师则重定向到对应页面
    if session.get('role') != 'teacher':
        if session.get('role') == 'student':
            return redirect('/student/dashboard')
        elif session.get('role') == 'admin':
            return redirect('/admin/dashboard')
    
    return serve_frontend_subdir('pages', 'teacher-dashboard.html')

@app.route('/admin/dashboard')
def admin_dashboard_page():
    """管理员仪表板页面"""
    if 'user_id' not in session:
        return redirect('/')
    
    if session.get('role') != 'admin':
        # 如果不是管理员，重定向到对应页面
        if session.get('role') == 'student':
            return redirect('/student/dashboard')
        elif session.get('role') == 'teacher':
            return redirect('/teacher/dashboard')
        else:
            return redirect('/')
    
    return serve_frontend_subdir('pages', 'admin-dashboard.html')


# ==================== 静态资源路由 ====================

@app.route('/pages/<path:filename>')
def serve_pages(filename):
    """提供pages目录下的文件"""
    return serve_frontend_subdir('pages', filename)

@app.route('/css/<path:filename>')
def serve_css(filename):
    """提供CSS文件"""
    return serve_frontend_subdir('css', filename)

@app.route('/js/<path:filename>')
def serve_js(filename):
    """提供JavaScript文件"""
    return serve_frontend_subdir('js', filename)
# ==================== 辅助函数 ====================

def serve_frontend_file(filename):
    """提供前端文件"""
    return send_from_directory(FRONTEND_DIR, filename)

def serve_frontend_subdir(subdir, filename):
    """提供前端子目录文件"""
    path = os.path.join(FRONTEND_DIR, subdir)
    return send_from_directory(path, filename)
# ==================== 后端API测试路由 ====================

@app.route('/api/test-db')
def test_db():
    """测试数据库连接"""
    try:
        result = db.session.execute(text("SELECT 1"))
        data = result.fetchone()
        return jsonify({
            "success": True,
            "message": "数据库连接成功",
            "data": {"result": data[0]}
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"数据库连接失败：{str(e)}"
        }), 500

@app.route('/api/test-auth')
def test_auth():
    """测试认证功能"""
    return jsonify({
        "endpoints": {
            "login": "/api/auth/login (POST)",
            "logout": "/api/auth/logout (GET)",
            "current_user": "/api/auth/current-user (GET)"
        },
        "test_users": [
            {"username": "zhangsan", "password": "123456", "role": "student"},
            {"username": "zhang_prof", "password": "123456", "role": "teacher"},
            {"username": "admin", "password": "123456", "role": "admin"}
        ]
    })

@app.route('/api/profile')
@login_required
def profile():
    """获取当前用户信息"""
    return jsonify({
        "user_id": session.get('user_id'),
        "username": session.get('username'),
        "role": session.get('role')
    })

# ==================== 后端功能路由（示例） ====================

@app.route('/api/teacher/dashboard')
@teacher_only
def teacher_dashboard():
    """教师仪表板API"""
    return jsonify({
        "message": "教师仪表板API（功能待开发）",
        "role": "teacher"
    })

@app.route('/api/admin/dashboard')
@admin_only
def admin_dashboard():
    """管理员仪表板API"""
    return jsonify({
        "message": "管理员仪表板API（功能待开发）",
        "role": "admin"
    })

# ==================== 应用启动 ====================

if __name__ == '__main__':
    # 在第一次运行时创建表（如果不存在）
    with app.app_context():
        db.create_all()
        print("数据库表已检查/创建")
        print(f"前端文件目录: {FRONTEND_DIR}")
        print("服务器启动在: http://localhost:5000")
        print("API接口前缀: /api")
        print("静态文件路径: /css/*, /js/*")
    
    app.run(debug=True, host='0.0.0.0', port=5000)