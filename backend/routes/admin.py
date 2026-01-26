"""
backend/routes/admin.py - 管理员管理API
"""
from flask import Blueprint, request, jsonify, session, g
from backend import models
from backend.app import db
from backend.utils.decorators import admin_only, login_required
from backend.utils.security import SecurityUtils
import datetime
import re

# 创建蓝图
admin_bp = Blueprint('admin', __name__)

# ==================== 通用工具函数 ====================

def create_response(success=True, data=None, message=None, error=None, code=200):
    """创建标准API响应"""
    response = {
        'success': success,
        'timestamp': datetime.datetime.now().isoformat()
    }
    
    if data is not None:
        response['data'] = data
    
    if message:
        response['message'] = message
    
    if error:
        response['error'] = error
    
    return jsonify(response), code

def log_action(action_type, description, result='success'):
    """记录管理员操作日志"""
    user_id = session.get('user_id')
    if user_id:
        log = models.AuditLog(
            user_id=user_id,
            action_type=action_type,
            description=description,
            ip_address=request.remote_addr,
            result=result
        )
        db.session.add(log)
        db.session.commit()

def validate_email(email):
    """验证邮箱格式"""
    if not email:
        return True
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_phone(phone):
    """验证手机号格式"""
    if not phone:
        return True
    pattern = r'^1[3-9]\d{9}$'
    return re.match(pattern, phone) is not None

def validate_id_card(id_card):
    """验证身份证号格式"""
    if not id_card:
        return False
    pattern = r'^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dX]$'
    return re.match(pattern, id_card) is not None

# ==================== 用户管理API ====================

@admin_bp.route('/users', methods=['GET'])
@admin_only
def get_all_users():
    """获取所有用户列表"""
    try:
        # 获取查询参数
        role = request.args.get('role', '')
        status = request.args.get('status', '')
        keyword = request.args.get('keyword', '').strip()
        
        query = models.User.query
        
        # 按角色筛选
        if role:
            query = query.filter(models.User.role == role)
        
        # 按状态筛选
        if status:
            query = query.filter(models.User.status == status)
        
        # 关键词搜索（用户名或用户ID）
        if keyword:
            query = query.filter(
                models.User.username.ilike(f'%{keyword}%') |
                models.User.user_id.ilike(f'%{keyword}%')
            )
        
        # 排序：管理员优先，然后按创建时间倒序
        users = query.order_by(
            models.User.role == 'admin',
            models.User.created_at.desc()
        ).all()
        
        user_list = []
        for user in users:
            # 获取用户详细信息
            user_info = {
                'user_id': user.user_id,
                'username': user.username,
                'role': user.role,
                'status': user.status,
                'last_login': user.last_login.isoformat() if user.last_login else None,
                'created_at': user.created_at.isoformat() if user.created_at else None
            }
            
            # 根据角色获取额外信息
            if user.role == 'student':
                student = models.Student.query.get(user.user_id)
                if student:
                    user_info['name'] = student.name
                    user_info['department'] = student.department
                    user_info['major'] = student.major
            elif user.role == 'teacher':
                teacher = models.Teacher.query.get(user.user_id)
                if teacher:
                    user_info['name'] = teacher.name
                    user_info['department'] = teacher.department
                    user_info['title'] = teacher.title
            
            user_list.append(user_info)
        
        return create_response(data=user_list, message='用户列表获取成功')
        
    except Exception as e:
        return create_response(success=False, error=f'获取用户列表失败: {str(e)}', code=500)

@admin_bp.route('/users', methods=['POST'])
@admin_only
def create_user():
    """创建新用户"""
    try:
        data = request.get_json()
        
        # 验证必需字段
        required_fields = ['user_id', 'username', 'password', 'role']
        for field in required_fields:
            if field not in data or not data[field]:
                return create_response(success=False, error=f'{field}不能为空', code=400)
        
        # 验证用户ID格式（学号或工号）
        if not data['user_id'].strip():
            return create_response(success=False, error='用户ID不能为空', code=400)
        
        # 验证用户名
        if len(data['username']) < 3:
            return create_response(success=False, error='用户名至少3个字符', code=400)
        
        # 验证密码强度
        if len(data['password']) < 6:
            return create_response(success=False, error='密码至少6个字符', code=400)
        
        # 验证角色
        valid_roles = ['student', 'teacher', 'admin']
        if data['role'] not in valid_roles:
            return create_response(success=False, error='角色不合法', code=400)
        
        # 检查用户是否已存在
        existing_user = models.User.query.get(data['user_id'])
        if existing_user:
            return create_response(success=False, error='用户ID已存在', code=400)
        
        # 检查用户名是否已存在
        existing_username = models.User.query.filter_by(username=data['username']).first()
        if existing_username:
            return create_response(success=False, error='用户名已存在', code=400)
        
        # 创建用户
        user = models.User(
            user_id=data['user_id'],
            username=data['username'],
            password_hash=SecurityUtils.hash_password(data['password']),
            role=data['role'],
            status='active'
        )
        
        db.session.add(user)
        db.session.commit()
        
        # 根据角色创建相应的详细信息记录
        if data['role'] == 'student':
            student = models.Student(
                student_id=data['user_id'],
                name=data.get('name', ''),
                email=data.get('email', ''),
                department=data.get('department', ''),
                major=data.get('major', ''),
                enrollment_year=data.get('enrollment_year', datetime.datetime.now().year)
            )
            
            # 加密敏感信息（如果提供）
            if data.get('id_card'):
                if validate_id_card(data['id_card']):
                    student.id_card_encrypted = SecurityUtils.encrypt_data(data['id_card'])
                else:
                    return create_response(success=False, error='身份证号格式不正确', code=400)
            
            if data.get('phone'):
                if validate_phone(data['phone']):
                    student.phone_encrypted = SecurityUtils.encrypt_data(data['phone'])
                else:
                    return create_response(success=False, error='手机号格式不正确', code=400)
            
            db.session.add(student)
            
        elif data['role'] == 'teacher':
            teacher = models.Teacher(
                teacher_id=data['user_id'],
                name=data.get('name', ''),
                email=data.get('email', ''),
                department=data.get('department', ''),
                title=data.get('title', '')
            )
            db.session.add(teacher)
        
        db.session.commit()
        
        # 记录操作日志
        log_action(
            'create_user',
            f'创建用户: {data["username"]} ({data["user_id"]})，角色: {data["role"]}',
            'success'
        )
        
        return create_response(
            data={'user_id': user.user_id, 'username': user.username, 'role': user.role},
            message='用户创建成功'
        )
        
    except Exception as e:
        db.session.rollback()
        return create_response(success=False, error=f'创建用户失败: {str(e)}', code=500)

@admin_bp.route('/users/<user_id>', methods=['PUT'])
@admin_only
def update_user(user_id):
    """更新用户信息"""
    try:
        user = models.User.query.get(user_id)
        if not user:
            return create_response(success=False, error='用户不存在', code=404)
        
        data = request.get_json()
        
        # 允许更新的字段
        if 'status' in data and data['status'] in ['active', 'inactive']:
            user.status = data['status']
        
        if 'username' in data and data['username']:
            # 检查用户名是否重复
            existing = models.User.query.filter(
                models.User.username == data['username'],
                models.User.user_id != user_id
            ).first()
            if existing:
                return create_response(success=False, error='用户名已存在', code=400)
            user.username = data['username']
        
        user.updated_at = datetime.datetime.now()
        db.session.commit()
        
        # 记录操作日志
        log_action(
            'update_user',
            f'更新用户: {user.username} ({user.user_id})，状态: {user.status}',
            'success'
        )
        
        return create_response(message='用户信息更新成功')
        
    except Exception as e:
        db.session.rollback()
        return create_response(success=False, error=f'更新用户失败: {str(e)}', code=500)

@admin_bp.route('/users/<user_id>', methods=['DELETE'])
@admin_only
def delete_user(user_id):
    """删除用户"""
    try:
        user = models.User.query.get(user_id)
        if not user:
            return create_response(success=False, error='用户不存在', code=404)
        
        # 检查用户是否有选课记录
        if user.role == 'student':
            enrollments = models.Enrollment.query.filter_by(student_id=user_id).count()
            if enrollments > 0:
                return create_response(success=False, error='该学生有选课记录，无法删除', code=400)
        
        # 检查教师是否有教学任务
        if user.role == 'teacher':
            teachings = models.Teaching.query.filter_by(teacher_id=user_id).count()
            if teachings > 0:
                return create_response(success=False, error='该教师有教学任务，无法删除', code=400)
        
        # 记录删除前的信息用于日志
        username = user.username
        role = user.role
        
        # 删除用户
        db.session.delete(user)
        
        # 删除对应的详细信息
        if role == 'student':
            student = models.Student.query.get(user_id)
            if student:
                db.session.delete(student)
        elif role == 'teacher':
            teacher = models.Teacher.query.get(user_id)
            if teacher:
                db.session.delete(teacher)
        
        db.session.commit()
        
        # 记录操作日志
        log_action(
            'delete_user',
            f'删除用户: {username} ({user_id})，角色: {role}',
            'success'
        )
        
        return create_response(message='用户删除成功')
        
    except Exception as e:
        db.session.rollback()
        return create_response(success=False, error=f'删除用户失败: {str(e)}', code=500)

@admin_bp.route('/users/<user_id>/reset-password', methods=['POST'])
@admin_only
def reset_password(user_id):
    """重置用户密码"""
    try:
        user = models.User.query.get(user_id)
        if not user:
            return create_response(success=False, error='用户不存在', code=404)
        
        data = request.get_json()
        new_password = data.get('new_password', '123456')  # 默认密码
        
        if len(new_password) < 6:
            return create_response(success=False, error='密码至少6个字符', code=400)
        
        # 更新密码
        user.password_hash = SecurityUtils.hash_password(new_password)
        user.updated_at = datetime.datetime.now()
        db.session.commit()
        
        # 记录操作日志
        log_action(
            'reset_password',
            f'重置用户密码: {user.username} ({user.user_id})',
            'success'
        )
        
        return create_response(message='密码重置成功')
        
    except Exception as e:
        db.session.rollback()
        return create_response(success=False, error=f'重置密码失败: {str(e)}', code=500)

# ==================== 学生管理API ====================

@admin_bp.route('/students', methods=['GET'])
@admin_only
def get_all_students():
    """获取所有学生列表（包含详细信息）"""
    try:
        # 获取查询参数
        department = request.args.get('department', '')
        status = request.args.get('status', '')
        keyword = request.args.get('keyword', '').strip()
        year = request.args.get('year', '')
        
        query = models.Student.query
        
        # 按院系筛选
        if department:
            query = query.filter(models.Student.department == department)
        
        # 按状态筛选
        if status:
            query = query.filter(models.Student.status == status)
        
        # 按入学年份筛选
        if year:
            query = query.filter(models.Student.enrollment_year == int(year))
        
        # 关键词搜索（姓名、学号、专业）
        if keyword:
            query = query.filter(
                models.Student.student_id.ilike(f'%{keyword}%') |
                models.Student.name.ilike(f'%{keyword}%') |
                models.Student.major.ilike(f'%{keyword}%')
            )
        
        # 按学号排序
        students = query.order_by(models.Student.student_id).all()
        
        student_list = []
        for student in students:
            # 解密敏感信息（管理员权限）
            student_info = {
                'student_id': student.student_id,
                'name': student.name,
                'gender': student.gender,
                'birth_date': student.birth_date.isoformat() if student.birth_date else None,
                'id_card': SecurityUtils.decrypt_data(student.id_card_encrypted) if student.id_card_encrypted else None,
                'phone': SecurityUtils.decrypt_data(student.phone_encrypted) if student.phone_encrypted else None,
                'email': student.email,
                'department': student.department,
                'major': student.major,
                'enrollment_year': student.enrollment_year,
                'status': student.status,
                'created_at': student.created_at.isoformat() if student.created_at else None,
                'updated_at': student.updated_at.isoformat() if student.updated_at else None
            }
            
            # 获取用户账户状态
            user = models.User.query.get(student.student_id)
            if user:
                student_info['account_status'] = user.status
                student_info['username'] = user.username
                student_info['last_login'] = user.last_login.isoformat() if user.last_login else None
            
            student_list.append(student_info)
        
        return create_response(data=student_list, message='学生列表获取成功')
        
    except Exception as e:
        return create_response(success=False, error=f'获取学生列表失败: {str(e)}', code=500)

@admin_bp.route('/students/<student_id>', methods=['PUT'])
@admin_only
def update_student(student_id):
    """更新学生信息"""
    try:
        student = models.Student.query.get(student_id)
        if not student:
            return create_response(success=False, error='学生不存在', code=404)
        
        data = request.get_json()
        
        # 验证邮箱格式
        if 'email' in data and data['email']:
            if not validate_email(data['email']):
                return create_response(success=False, error='邮箱格式不正确', code=400)
            student.email = data['email']
        
        # 验证手机号格式并加密
        if 'phone' in data:
            if data['phone']:
                if not validate_phone(data['phone']):
                    return create_response(success=False, error='手机号格式不正确', code=400)
                student.phone_encrypted = SecurityUtils.encrypt_data(data['phone'])
            else:
                student.phone_encrypted = None
        
        # 验证身份证号格式并加密
        if 'id_card' in data:
            if data['id_card']:
                if not validate_id_card(data['id_card']):
                    return create_response(success=False, error='身份证号格式不正确', code=400)
                student.id_card_encrypted = SecurityUtils.encrypt_data(data['id_card'])
            else:
                student.id_card_encrypted = None
        
        # 更新其他字段
        allowed_fields = ['name', 'gender', 'birth_date', 'department', 'major', 
                         'enrollment_year', 'status']
        for field in allowed_fields:
            if field in data and data[field] is not None:
                setattr(student, field, data[field])
        
        student.updated_at = datetime.datetime.now()
        db.session.commit()
        
        # 记录操作日志
        log_action(
            'update_student',
            f'更新学生信息: {student.name} ({student_id})',
            'success'
        )
        
        return create_response(message='学生信息更新成功')
        
    except Exception as e:
        db.session.rollback()
        return create_response(success=False, error=f'更新学生信息失败: {str(e)}', code=500)

@admin_bp.route('/students/batch-update', methods=['POST'])
@admin_only
def batch_update_students():
    """批量更新学生状态"""
    try:
        data = request.get_json()
        student_ids = data.get('student_ids', [])
        status = data.get('status', '')
        
        if not student_ids:
            return create_response(success=False, error='没有选择学生', code=400)
        
        if status not in ['active', 'leave', 'graduated']:
            return create_response(success=False, error='状态不合法', code=400)
        
        updated_count = 0
        for student_id in student_ids:
            student = models.Student.query.get(student_id)
            if student:
                student.status = status
                student.updated_at = datetime.datetime.now()
                updated_count += 1
        
        db.session.commit()
        
        # 记录操作日志
        log_action(
            'batch_update_students',
            f'批量更新{updated_count}名学生状态为: {status}',
            'success'
        )
        
        return create_response(
            data={'updated_count': updated_count},
            message=f'成功更新{updated_count}名学生状态'
        )
        
    except Exception as e:
        db.session.rollback()
        return create_response(success=False, error=f'批量更新失败: {str(e)}', code=500)

@admin_bp.route('/students', methods=['POST'])
@admin_only
def create_student():
    """创建新学生（学生管理页面专用）"""
    try:
        data = request.get_json()
        
        # 验证必需字段（用户基础+学生特有）
        required_fields = ['student_id', 'username', 'password', 'name', 'department', 'major']
        for field in required_fields:
            if field not in data or not data[field]:
                return create_response(success=False, error=f'{field}不能为空', code=400)
        
        # 基础格式验证
        if len(data['username']) < 3:
            return create_response(success=False, error='用户名至少3个字符', code=400)
        if len(data['password']) < 6:
            return create_response(success=False, error='密码至少6个字符', code=400)
        
        # 检查重复
        if models.User.query.get(data['student_id']):
            return create_response(success=False, error='学号已存在', code=400)
        if models.User.query.filter_by(username=data['username']).first():
            return create_response(success=False, error='用户名已存在', code=400)
        
        # 1. 创建用户记录（role=student）
        user = models.User(
            user_id=data['student_id'],
            username=data['username'],
            password_hash=SecurityUtils.hash_password(data['password']),
            role='student',
            status='active'
        )
        db.session.add(user)
        
        # 2. 创建学生记录（敏感信息加密）
        student = models.Student(
            student_id=data['student_id'],
            name=data['name'],
            gender=data.get('gender'),
            birth_date=data.get('birth_date'),
            email=data.get('email'),
            department=data['department'],
            major=data['major'],
            enrollment_year=data.get('enrollment_year', datetime.datetime.now().year),
            status='active'
        )
        
        # 加密身份证号/手机号（符合敏感信息机密性要求）
        if data.get('id_card'):
            if validate_id_card(data['id_card']):
                student.id_card_encrypted = SecurityUtils.encrypt_data(data['id_card'])
            else:
                return create_response(success=False, error='身份证号格式不正确', code=400)
        if data.get('phone'):
            if validate_phone(data['phone']):
                student.phone_encrypted = SecurityUtils.encrypt_data(data['phone'])
            else:
                return create_response(success=False, error='手机号格式不正确', code=400)
        
        db.session.add(student)
        db.session.commit()
        
        # 记录操作日志
        log_action(
            'create_student',
            f'创建学生: {data["name"]} ({data["student_id"]})',
            'success'
        )
        
        return create_response(
            data={'student_id': data['student_id'], 'name': data['name']},
            message='学生创建成功'
        )
        
    except Exception as e:
        db.session.rollback()
        return create_response(success=False, error=f'创建学生失败: {str(e)}', code=500)

@admin_bp.route('/students/<student_id>', methods=['DELETE'])
@admin_only
def delete_student(student_id):
    """删除学生（学生管理页面专用）"""
    try:
        # 验证学生身份
        student = models.Student.query.get(student_id)
        if not student:
            return create_response(success=False, error='学生不存在', code=404)
        
        # 验证关联用户是否为学生角色（避免误删管理员/教师）
        if not student.user or student.user.role != 'student':
            return create_response(success=False, error='该记录非学生账号，无法删除', code=404)
        
        # 检查选课记录（防止数据残留）
        if models.Enrollment.query.filter_by(student_id=student_id).count() > 0:
            return create_response(success=False, error='该学生有选课记录，无法删除', code=400)
        
        # 记录日志信息
        student_name = student.name
        
        # 删除关联记录
        db.session.delete(student)
        db.session.commit()
        
        log_action(
            'delete_student',
            f'删除学生: {student_name} ({student_id})',
            'success'
        )
        
        return create_response(message='学生删除成功')
        
    except Exception as e:
        db.session.rollback()
        return create_response(success=False, error=f'删除学生失败: {str(e)}', code=500)
# ==================== 教师管理API ====================

@admin_bp.route('/teachers', methods=['GET'])
@admin_only
def get_all_teachers():
    """获取所有教师列表"""
    try:
        # 获取查询参数
        department = request.args.get('department', '')
        keyword = request.args.get('keyword', '').strip()
        
        query = models.Teacher.query
        
        # 按院系筛选
        if department:
            query = query.filter(models.Teacher.department == department)
        
        # 关键词搜索（姓名、工号）
        if keyword:
            query = query.filter(
                models.Teacher.teacher_id.ilike(f'%{keyword}%') |
                models.Teacher.name.ilike(f'%{keyword}%')
            )
        
        # 按工号排序
        teachers = query.order_by(models.Teacher.teacher_id).all()
        
        teacher_list = []
        for teacher in teachers:
            teacher_info = {
                'teacher_id': teacher.teacher_id,
                'name': teacher.name,
                'gender': teacher.gender,
                'title': teacher.title,
                'department': teacher.department,
                'office': teacher.office,
                'phone': teacher.phone,
                'email': teacher.email,
                'created_at': teacher.created_at.isoformat() if teacher.created_at else None,
                'updated_at': teacher.updated_at.isoformat() if teacher.updated_at else None
            }
            
            # 获取用户账户状态
            user = models.User.query.get(teacher.teacher_id)
            if user:
                teacher_info['account_status'] = user.status
                teacher_info['username'] = user.username
                teacher_info['last_login'] = user.last_login.isoformat() if user.last_login else None
            
            # 获取教学任务数量
            teaching_count = models.Teaching.query.filter_by(teacher_id=teacher.teacher_id).count()
            teacher_info['teaching_count'] = teaching_count
            
            teacher_list.append(teacher_info)
        
        return create_response(data=teacher_list, message='教师列表获取成功')
        
    except Exception as e:
        return create_response(success=False, error=f'获取教师列表失败: {str(e)}', code=500)

@admin_bp.route('/teachers/<teacher_id>', methods=['PUT'])
@admin_only
def update_teacher(teacher_id):
    """更新教师信息"""
    try:
        teacher = models.Teacher.query.get(teacher_id)
        if not teacher:
            return create_response(success=False, error='教师不存在', code=404)
        
        data = request.get_json()
        
        # 验证邮箱格式
        if 'email' in data and data['email']:
            if not validate_email(data['email']):
                return create_response(success=False, error='邮箱格式不正确', code=400)
            teacher.email = data['email']
        
        # 验证手机号格式
        if 'phone' in data and data['phone']:
            if not validate_phone(data['phone']):
                return create_response(success=False, error='手机号格式不正确', code=400)
            teacher.phone = data['phone']
        
        # 更新其他字段
        allowed_fields = ['name', 'gender', 'title', 'department', 'office']
        for field in allowed_fields:
            if field in data and data[field] is not None:
                setattr(teacher, field, data[field])
        
        teacher.updated_at = datetime.datetime.now()
        db.session.commit()
        
        # 记录操作日志
        log_action(
            'update_teacher',
            f'更新教师信息: {teacher.name} ({teacher_id})',
            'success'
        )
        
        return create_response(message='教师信息更新成功')
        
    except Exception as e:
        db.session.rollback()
        return create_response(success=False, error=f'更新教师信息失败: {str(e)}', code=500)

@admin_bp.route('/teachers', methods=['POST'])
@admin_only
def create_teacher():
    """创建新教师（教师管理页面专用）"""
    try:
        data = request.get_json()
        
        # 验证必需字段
        required_fields = ['teacher_id', 'username', 'password', 'name', 'department', 'title']
        for field in required_fields:
            if field not in data or not data[field]:
                return create_response(success=False, error=f'{field}不能为空', code=400)
        
        # 基础格式验证
        if len(data['username']) < 3:
            return create_response(success=False, error='用户名至少3个字符', code=400)
        if len(data['password']) < 6:
            return create_response(success=False, error='密码至少6个字符', code=400)
        
        # 检查重复
        if models.User.query.get(data['teacher_id']):
            return create_response(success=False, error='工号已存在', code=400)
        if models.User.query.filter_by(username=data['username']).first():
            return create_response(success=False, error='用户名已存在', code=400)
        
        # 1. 创建用户记录（role=teacher）
        user = models.User(
            user_id=data['teacher_id'],
            username=data['username'],
            password_hash=SecurityUtils.hash_password(data['password']),
            role='teacher',
            status='active'
        )
        db.session.add(user)
        
        # 2. 创建教师记录
        teacher = models.Teacher(
            teacher_id=data['teacher_id'],
            name=data['name'],
            gender=data.get('gender'),
            title=data['title'],
            department=data['department'],
            office=data.get('office', ''),
            phone=data.get('phone', ''),
            email=data.get('email', '')
        )
        db.session.add(teacher)
        db.session.commit()
        
        log_action(
            'create_teacher',
            f'创建教师: {data["name"]} ({data["teacher_id"]})',
            'success'
        )
        
        return create_response(
            data={'teacher_id': data['teacher_id'], 'name': data['name']},
            message='教师创建成功'
        )
        
    except Exception as e:
        db.session.rollback()
        return create_response(success=False, error=f'创建教师失败: {str(e)}', code=500)

@admin_bp.route('/teachers/<teacher_id>', methods=['DELETE'])
@admin_only
def delete_teacher(teacher_id):
    """删除教师（教师管理页面专用）"""
    try:

        # 验证教师身份
        teacher = models.Teacher.query.get(teacher_id)
        if not teacher:
            return create_response(success=False, error='教师不存在', code=404)
        
        # 验证该教师是否关联有效用户（防止脏数据）
        teacher_user = models.User.query.get(teacher_id)  # user_id与teacher_id一致
        if not teacher_user or teacher_user.role != 'teacher':
            return create_response(success=False, error='该记录未关联教师账号，无法删除', code=404)

        # 检查教学任务（防止数据残留）
        if models.Teaching.query.filter_by(teacher_id=teacher_id).count() > 0:
            return create_response(success=False, error='该教师有教学任务，无法删除', code=400)
        
        # 记录日志信息
        teacher_name = teacher.name
        
        # 删除关联记录
        db.session.delete(teacher_user)
        db.session.delete(teacher)       
        db.session.commit()
        
        log_action(
            'delete_teacher',
            f'删除教师: {teacher_name} ({teacher_id})',
            'success'
        )
        
        return create_response(message='教师删除成功')
        
    except Exception as e:
        db.session.rollback()
        return create_response(success=False, error=f'删除教师失败: {str(e)}', code=500)
    
# ==================== 课程管理API（管理员权限） ====================

@admin_bp.route('/courses', methods=['POST'])
@admin_only
def admin_create_course():
    """管理员创建课程"""
    try:
        data = request.get_json()
        
        # 验证必需字段
        required_fields = ['course_id', 'course_name', 'credits', 'hours', 'semester']
        for field in required_fields:
            if not data.get(field):
                return create_response(success=False, error=f'{field}不能为空', code=400)
        
        # 检查课程是否已存在
        existing_course = models.Course.query.get(data['course_id'])
        if existing_course:
            return create_response(success=False, error='课程ID已存在', code=400)
        
        # 创建课程
        course = models.Course(
            course_id=data['course_id'],
            course_name=data['course_name'],
            credits=float(data['credits']),
            hours=int(data['hours']),
            type=data.get('type', 'elective'),
            semester=data['semester'],
            description=data.get('description', ''),
            capacity=int(data.get('capacity', 50)),
            current_enrollment=0
        )
        
        db.session.add(course)
        
        # 如果有分配教师，创建教学任务
        teacher_id = data.get('teacher_id')
        if teacher_id:
            # 验证教师是否存在
            teacher = models.Teacher.query.get(teacher_id)
            if not teacher:
                return create_response(success=False, error='教师不存在', code=400)
            
            teaching = models.Teaching(
                teacher_id=teacher_id,
                course_id=data['course_id'],
                teaching_time=data.get('teaching_time'),
                location=data.get('location'),
                class_no=data.get('class_no')
            )
            db.session.add(teaching)
        
        db.session.commit()
        
        # 记录操作日志
        log_action(
            'admin_create_course',
            f'创建课程: {data["course_name"]} ({data["course_id"]})',
            'success'
        )
        
        return create_response(
            data={'course_id': course.course_id},
            message='课程创建成功'
        )
        
    except Exception as e:
        db.session.rollback()
        return create_response(success=False, error=f'创建课程失败: {str(e)}', code=500)

@admin_bp.route('/courses/<course_id>/assign-teacher', methods=['POST'])
@admin_only
def assign_teacher_to_course(course_id):
    """为课程分配教师"""
    try:
        course = models.Course.query.get(course_id)
        if not course:
            return create_response(success=False, error='课程不存在', code=404)
        
        data = request.get_json()
        teacher_id = data.get('teacher_id')
        
        if not teacher_id:
            return create_response(success=False, error='教师ID不能为空', code=400)
        
        # 验证教师是否存在
        teacher = models.Teacher.query.get(teacher_id)
        if not teacher:
            return create_response(success=False, error='教师不存在', code=400)
        
        # 检查是否已有教学任务
        existing_teaching = models.Teaching.query.filter_by(course_id=course_id).first()
        if existing_teaching:
            # 更新现有教学任务
            existing_teaching.teacher_id = teacher_id
            if 'teaching_time' in data:
                existing_teaching.teaching_time = data['teaching_time']
            if 'location' in data:
                existing_teaching.location = data['location']
            if 'class_no' in data:
                existing_teaching.class_no = data['class_no']
        else:
            # 创建新的教学任务
            teaching = models.Teaching(
                teacher_id=teacher_id,
                course_id=course_id,
                teaching_time=data.get('teaching_time'),
                location=data.get('location'),
                class_no=data.get('class_no')
            )
            db.session.add(teaching)
        
        db.session.commit()
        
        # 记录操作日志
        log_action(
            'assign_teacher',
            f'为课程 {course.course_name} ({course_id}) 分配教师 {teacher.name} ({teacher_id})',
            'success'
        )
        
        return create_response(message='教师分配成功')
        
    except Exception as e:
        db.session.rollback()
        return create_response(success=False, error=f'分配教师失败: {str(e)}', code=500)

@admin_bp.route('/courses/<course_id>/remove-teacher', methods=['POST'])
@admin_only
def remove_teacher_from_course(course_id):
    """从课程移除教师"""
    try:
        course = models.Course.query.get(course_id)
        if not course:
            return create_response(success=False, error='课程不存在', code=404)
        
        # 删除教学任务
        deleted_count = models.Teaching.query.filter_by(course_id=course_id).delete()
        
        if deleted_count > 0:
            db.session.commit()
            
            # 记录操作日志
            log_action(
                'remove_teacher',
                f'从课程 {course.course_name} ({course_id}) 移除教师',
                'success'
            )
            
            return create_response(message='教师移除成功')
        else:
            return create_response(success=False, error='该课程没有分配教师', code=400)
        
    except Exception as e:
        db.session.rollback()
        return create_response(success=False, error=f'移除教师失败: {str(e)}', code=500)

# ==================== 操作审计API ====================

@admin_bp.route('/audit-logs', methods=['GET'])
@admin_only
def get_audit_logs():
    """获取操作审计日志"""
    try:
        # 获取查询参数
        user_id = request.args.get('user_id', '')
        action_type = request.args.get('action_type', '')
        result = request.args.get('result', '')
        start_date = request.args.get('start_date', '')
        end_date = request.args.get('end_date', '')
        keyword = request.args.get('keyword', '').strip()
        
        query = models.AuditLog.query
        
        # 按用户筛选
        if user_id:
            query = query.filter(models.AuditLog.user_id == user_id)
        
        # 按操作类型筛选
        if action_type:
            query = query.filter(models.AuditLog.action_type == action_type)
        
        # 按结果筛选
        if result:
            query = query.filter(models.AuditLog.result == result)
        
        # 按日期范围筛选
        if start_date:
            try:
                start_datetime = datetime.datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                query = query.filter(models.AuditLog.timestamp >= start_datetime)
            except ValueError:
                pass
        
        if end_date:
            try:
                end_datetime = datetime.datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                query = query.filter(models.AuditLog.timestamp <= end_datetime)
            except ValueError:
                pass
        
        # 关键词搜索（描述或操作类型）
        if keyword:
            query = query.filter(
                models.AuditLog.description.ilike(f'%{keyword}%') |
                models.AuditLog.action_type.ilike(f'%{keyword}%')
            )
        
        # 按时间倒序排列
        logs = query.order_by(models.AuditLog.timestamp.desc()).all()
        
        log_list = []
        for log in logs:
            # 获取用户信息
            user = models.User.query.get(log.user_id)
            
            log_info = {
                'log_id': log.log_id,
                'user_id': log.user_id,
                'username': user.username if user else '未知',
                'user_role': user.role if user else '未知',
                'action_type': log.action_type,
                'description': log.description,
                'ip_address': log.ip_address,
                'result': log.result,
                'timestamp': log.timestamp.isoformat() if log.timestamp else None
            }
            
            log_list.append(log_info)
        
        # 获取统计信息
        total_logs = len(log_list)
        success_logs = len([log for log in log_list if log['result'] == 'success'])
        failure_logs = total_logs - success_logs
        
        stats = {
            'total': total_logs,
            'success': success_logs,
            'failure': failure_logs
        }
        
        return create_response(
            data={'logs': log_list, 'statistics': stats},
            message='审计日志获取成功'
        )
        
    except Exception as e:
        return create_response(success=False, error=f'获取审计日志失败: {str(e)}', code=500)

@admin_bp.route('/audit-logs/statistics', methods=['GET'])
@admin_only
def get_audit_statistics():
    """获取审计统计信息"""
    try:
        # 最近7天的日志统计
        seven_days_ago = datetime.datetime.now() - datetime.timedelta(days=7)
        
        # 按操作类型统计
        type_stats = db.session.query(
            models.AuditLog.action_type,
            db.func.count(models.AuditLog.log_id)
        ).filter(
            models.AuditLog.timestamp >= seven_days_ago
        ).group_by(
            models.AuditLog.action_type
        ).all()
        
        # 按用户统计
        user_stats = db.session.query(
            models.AuditLog.user_id,
            db.func.count(models.AuditLog.log_id)
        ).filter(
            models.AuditLog.timestamp >= seven_days_ago
        ).group_by(
            models.AuditLog.user_id
        ).all()
        
        # 按结果统计
        result_stats = db.session.query(
            models.AuditLog.result,
            db.func.count(models.AuditLog.log_id)
        ).filter(
            models.AuditLog.timestamp >= seven_days_ago
        ).group_by(
            models.AuditLog.result
        ).all()
        
        # 每日统计
        daily_stats = db.session.query(
            db.func.date(models.AuditLog.timestamp),
            db.func.count(models.AuditLog.log_id)
        ).filter(
            models.AuditLog.timestamp >= seven_days_ago
        ).group_by(
            db.func.date(models.AuditLog.timestamp)
        ).order_by(
            db.func.date(models.AuditLog.timestamp).desc()
        ).all()
        
        statistics = {
            'by_type': [{'action_type': t[0], 'count': t[1]} for t in type_stats],
            'by_user': [{'user_id': u[0], 'count': u[1]} for u in user_stats],
            'by_result': [{'result': r[0], 'count': r[1]} for r in result_stats],
            'daily': [{'date': d[0].isoformat() if d[0] else None, 'count': d[1]} for d in daily_stats],
            'time_range': {
                'start': seven_days_ago.isoformat(),
                'end': datetime.datetime.now().isoformat()
            }
        }
        
        return create_response(data=statistics, message='审计统计获取成功')
        
    except Exception as e:
        return create_response(success=False, error=f'获取审计统计失败: {str(e)}', code=500)

# ==================== 数据安全监控API ====================

@admin_bp.route('/security-check', methods=['GET'])
@admin_only
def security_check():
    """数据安全监控检查"""
    try:
        security_report = {
            'timestamp': datetime.datetime.now().isoformat(),
            'encryption_status': {},
            'grade_integrity': {},
            'system_status': {}
        }
        
        # 检查学生敏感信息加密状态
        students = models.Student.query.all()
        total_students = len(students)
        
        id_card_encrypted_count = 0
        phone_encrypted_count = 0
        id_card_decryptable_count = 0
        phone_decryptable_count = 0
        
        for student in students:
            # 检查身份证号加密
            if student.id_card_encrypted:
                id_card_encrypted_count += 1
                try:
                    decrypted = SecurityUtils.decrypt_data(student.id_card_encrypted)
                    if decrypted and len(decrypted) == 18:
                        id_card_decryptable_count += 1
                except:
                    pass
            
            # 检查手机号加密
            if student.phone_encrypted:
                phone_encrypted_count += 1
                try:
                    decrypted = SecurityUtils.decrypt_data(student.phone_encrypted)
                    if decrypted and len(decrypted) >= 11:
                        phone_decryptable_count += 1
                except:
                    pass
        
        security_report['encryption_status']['students'] = {
            'total': total_students,
            'id_card': {
                'encrypted': id_card_encrypted_count,
                'encrypted_percentage': round(id_card_encrypted_count / total_students * 100, 2) if total_students > 0 else 0,
                'decryptable': id_card_decryptable_count,
                'decryptable_percentage': round(id_card_decryptable_count / total_students * 100, 2) if total_students > 0 else 0
            },
            'phone': {
                'encrypted': phone_encrypted_count,
                'encrypted_percentage': round(phone_encrypted_count / total_students * 100, 2) if total_students > 0 else 0,
                'decryptable': phone_decryptable_count,
                'decryptable_percentage': round(phone_decryptable_count / total_students * 100, 2) if total_students > 0 else 0
            }
        }
        
        # 检查成绩完整性
        enrollments = models.Enrollment.query.filter(models.Enrollment.grade.isnot(None)).all()
        total_grades = len(enrollments)
        
        has_hash_count = 0
        verified_count = 0
        
        for enrollment in enrollments:
            if enrollment.grade_hash:
                has_hash_count += 1
                try:
                    if SecurityUtils.verify_grade_hash(
                        enrollment.student_id,
                        enrollment.course_id,
                        enrollment.grade,
                        enrollment.grade_hash
                    ):
                        verified_count += 1
                except:
                    pass
        
        security_report['grade_integrity'] = {
            'total_grades': total_grades,
            'has_hash': has_hash_count,
            'has_hash_percentage': round(has_hash_count / total_grades * 100, 2) if total_grades > 0 else 0,
            'verified': verified_count,
            'verified_percentage': round(verified_count / total_grades * 100, 2) if total_grades > 0 else 0
        }
        
        # 系统状态
        security_report['system_status'] = {
            'users_count': models.User.query.count(),
            'active_users': models.User.query.filter_by(status='active').count(),
            'inactive_users': models.User.query.filter_by(status='inactive').count(),
            'courses_count': models.Course.query.count(),
            'enrollments_count': models.Enrollment.query.count(),
            'audit_logs_count': models.AuditLog.query.count(),
            'check_time': datetime.datetime.now().isoformat()
        }
        
        # 生成安全评级
        security_score = 0
        if total_students > 0:
            encryption_score = (id_card_decryptable_count + phone_decryptable_count) / (total_students * 2) * 50
        else:
            encryption_score = 0
        
        if total_grades > 0:
            integrity_score = verified_count / total_grades * 50
        else:
            integrity_score = 50  # 没有成绩时给默认分
        
        security_score = round(encryption_score + integrity_score, 2)
        
        # 确定安全等级
        if security_score >= 90:
            security_level = '优秀'
        elif security_score >= 75:
            security_level = '良好'
        elif security_score >= 60:
            security_level = '及格'
        else:
            security_level = '危险'
        
        security_report['security_score'] = security_score
        security_report['security_level'] = security_level
        security_report['recommendations'] = []
        
        # 生成建议
        if id_card_encrypted_count < total_students:
            security_report['recommendations'].append('部分学生身份证号未加密，建议立即处理')
        
        if phone_encrypted_count < total_students:
            security_report['recommendations'].append('部分学生手机号未加密，建议立即处理')
        
        if has_hash_count < total_grades:
            security_report['recommendations'].append('部分成绩未进行完整性保护，建议检查')
        
        if verified_count < has_hash_count:
            security_report['recommendations'].append('部分成绩哈希验证失败，可能存在数据篡改风险')
        
        return create_response(data=security_report, message='安全检查完成')
        
    except Exception as e:
        return create_response(success=False, error=f'安全检查失败: {str(e)}', code=500)

# ==================== 仪表板统计API ====================

@admin_bp.route('/dashboard-stats', methods=['GET'])
@admin_only
def dashboard_stats():
    """获取管理员仪表板统计信息"""
    try:
        # 用户统计
        total_users = models.User.query.count()
        active_users = models.User.query.filter_by(status='active').count()
        students_count = models.User.query.filter_by(role='student').count()
        teachers_count = models.User.query.filter_by(role='teacher').count()
        admins_count = models.User.query.filter_by(role='admin').count()
        
        # 学生统计
        students = models.Student.query.all()
        active_students = len([s for s in students if s.status == 'active'])
        leave_students = len([s for s in students if s.status == 'leave'])
        graduated_students = len([s for s in students if s.status == 'graduated'])
        
        # 院系统计
        departments = {}
        for student in students:
            if student.department:
                departments[student.department] = departments.get(student.department, 0) + 1
        
        # 课程统计
        total_courses = models.Course.query.count()
        current_semester_course = models.Course.query.order_by(models.Course.semester.desc()).first()
        current_semester = current_semester_course.semester if current_semester_course else None
        current_courses = models.Course.query.filter_by(semester=current_semester).count() if current_semester else 0
        
        # 选课统计
        total_enrollments = models.Enrollment.query.count()
        active_enrollments = models.Enrollment.query.filter_by(status='enrolled').count()
        completed_enrollments = models.Enrollment.query.filter_by(status='completed').count()
        
        # 教学任务统计
        total_teachings = models.Teaching.query.count()
        
        # 今日操作日志
        today = datetime.datetime.now().date()
        today_logs = models.AuditLog.query.filter(
            db.func.date(models.AuditLog.timestamp) == today
        ).count()
        
        stats = {
            'user_stats': {
                'total': total_users,
                'active': active_users,
                'students': students_count,
                'teachers': teachers_count,
                'admins': admins_count
            },
            'student_stats': {
                'total': len(students),
                'active': active_students,
                'leave': leave_students,
                'graduated': graduated_students,
                'departments': [{'name': k, 'count': v} for k, v in departments.items()]
            },
            'course_stats': {
                'total': total_courses,
                'current_semester': current_semester,
                'current': current_courses
            },
            'enrollment_stats': {
                'total': total_enrollments,
                'active': active_enrollments,
                'completed': completed_enrollments
            },
            'teaching_stats': {
                'total': total_teachings
            },
            'audit_stats': {
                'today': today_logs,
                'total': models.AuditLog.query.count()
            }
        }
        
        return create_response(data=stats, message='仪表板统计获取成功')
        
    except Exception as e:
        return create_response(success=False, error=f'获取统计信息失败: {str(e)}', code=500)

# ==================== 初始化数据API ====================

@admin_bp.route('/initialize-test-data', methods=['POST'])
@admin_only
def initialize_test_data():
    """初始化测试数据（开发环境使用）"""
    try:
        # 这是一个示例函数，用于快速创建测试数据
        # 在生产环境中应该禁用或严格限制访问
        
        # 记录操作日志
        log_action(
            'initialize_test_data',
            '初始化测试数据',
            'success'
        )
        
        return create_response(message='测试数据初始化完成')
        
    except Exception as e:
        return create_response(success=False, error=f'初始化测试数据失败: {str(e)}', code=500)