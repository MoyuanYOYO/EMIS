# backend/routes/auth.py - 用户认证路由
from flask import Blueprint, request, jsonify, session, redirect, url_for
from backend import models
from backend.app import db
from backend.utils.security import SecurityUtils
import datetime

# 创建蓝图
auth_bp = Blueprint('auth', __name__)

# 用户登录
@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': '用户名和密码不能为空'}), 400
    
    # 查找用户
    user = models.User.query.filter_by(username=username).first()
    
    if not user:
        return jsonify({'error': '用户不存在'}), 401
    
    # 验证密码
    if not SecurityUtils.check_password(password, user.password_hash):
        return jsonify({'error': '密码错误'}), 401
    
    # 检查用户状态
    if user.status != 'active':
        return jsonify({'error': '账户已被禁用'}), 403
    
    # 更新最后登录时间
    user.last_login = datetime.datetime.now()
    db.session.commit()
    
    # 设置会话
    session['user_id'] = user.user_id
    session['username'] = user.username
    session['role'] = user.role
    
    # 记录登录日志
    log = models.AuditLog(
        user_id=user.user_id,
        action_type='login',
        description=f'用户 {username} 登录系统',
        ip_address=request.remote_addr,
        result='success'
    )
    db.session.add(log)
    db.session.commit()
    
    # 根据角色返回不同信息
    user_info = {
        'user_id': user.user_id,
        'username': user.username,
        'role': user.role,
        'message': '登录成功'
    }
    
    return jsonify(user_info)

# 用户注销
@auth_bp.route('/logout', methods=['GET'])
def logout():
    # 记录日志
    if 'user_id' in session:
        log = models.AuditLog(
            user_id=session['user_id'],
            action_type='logout',
            description=f'用户 {session.get("username")} 注销',
            ip_address=request.remote_addr,
            result='success'
        )
        db.session.add(log)
        db.session.commit()
    
    # 清除会话
    session.clear()
    
    # 判断请求类型：如果是AJAX请求，返回JSON；否则重定向
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        # AJAX请求（来自JavaScript的fetch/ajax）
        return jsonify({
            'message': '已注销',
            'redirect': '/'
        })
    else:
        # 直接访问链接（用户点击链接）
        return redirect('/')

# 获取当前用户信息
@auth_bp.route('/current-user')
def current_user():
    if 'user_id' not in session:
        return jsonify({'error': '未登录'}), 401
    
    user = models.User.query.get(session['user_id'])
    if not user:
        return jsonify({'error': '用户不存在'}), 404
    
    user_info = {
        'user_id': user.user_id,
        'username': user.username,
        'role': user.role,
        'status': user.status,
        'last_login': user.last_login.isoformat() if user.last_login else None
    }
    
    # 根据角色获取详细信息
    if user.role == 'student':
        student = models.Student.query.get(user.user_id)
        if student:
            user_info['name'] = student.name
            user_info['department'] = student.department
    elif user.role == 'teacher':
        teacher = models.Teacher.query.get(user.user_id)
        if teacher:
            user_info['name'] = teacher.name
            user_info['department'] = teacher.department
    
    return jsonify(user_info)

# 简单的登录测试页面
@auth_bp.route('/test-login')
def test_login():
    return '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>测试登录</title>
        <script>
        async function login() {
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            const response = await fetch('/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const result = await response.json();
            if (response.ok) {
                document.getElementById('result').innerHTML = 
                    `登录成功！<br>用户名: ${result.username}<br>角色: ${result.role}<br>
                    <a href="/auth/current-user">查看当前用户信息</a><br>
                    <a href="/auth/logout">注销</a>`;
            } else {
                document.getElementById('result').innerHTML = 
                    `登录失败: ${result.error}`;
            }
        }
        
        async function getCurrentUser() {
            const response = await fetch('/auth/current-user');
            const result = await response.json();
            document.getElementById('result').innerHTML = 
                JSON.stringify(result, null, 2);
        }
        
        async function logout() {
            const response = await fetch('/auth/logout');
            const result = await response.json();
            document.getElementById('result').innerHTML = 
                `已注销: ${result.message}`;
        }
        </script>
    </head>
    <body>
        <h2>测试登录页面</h2>
        <div>
            <label>用户名: <input type="text" id="username" value="zhangsan"></label><br>
            <label>密码: <input type="password" id="password" value="123456"></label><br>
            <button onclick="login()">登录</button>
            <button onclick="getCurrentUser()">当前用户</button>
            <button onclick="logout()">注销</button>
        </div>
        <div id="result" style="margin-top: 20px; padding: 10px; border: 1px solid #ccc; min-height: 100px;"></div>
        <h3>测试账户</h3>
        <ul>
            <li>学生: zhangsan / 123456</li>
            <li>教师: zhang_prof / 123456</li>
            <li>管理员: admin / 123456</li>
        </ul>
    </body>
    </html>
    '''