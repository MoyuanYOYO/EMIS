"""
backend/routes/course.py - 课程管理API
"""
from flask import Blueprint, request, jsonify, session
from backend import models
from backend.app import db
from backend.utils.decorators import teacher_only, admin_only, login_required
import datetime

course_bp = Blueprint('course', __name__)

@course_bp.route('/', methods=['GET'])
@login_required
def get_all_courses():
    """获取所有课程"""
    try:
        courses = models.Course.query.order_by(models.Course.semester.desc(), models.Course.course_id).all()
        
        course_list = []
        for course in courses:
            # 获取授课教师
            teaching = models.Teaching.query.filter_by(course_id=course.course_id).first()
            teacher = models.Teacher.query.get(teaching.teacher_id) if teaching else None
            
            course_list.append({
                'course_id': course.course_id,
                'course_name': course.course_name,
                'credits': course.credits,
                'hours': course.hours,
                'type': course.type,
                'type_name': {
                    'compulsory': '必修',
                    'elective': '选修', 
                    'general': '通识'
                }.get(course.type, course.type),
                'semester': course.semester,
                'description': course.description,
                'capacity': course.capacity,
                'current_enrollment': course.current_enrollment,
                'available_seats': course.capacity - course.current_enrollment,
                'teacher_id': teacher.teacher_id if teacher else None,
                'teacher_name': teacher.name if teacher else '未分配',
                'created_at': course.created_at.isoformat() if course.created_at else None
            })
        
        return jsonify({'success': True, 'data': course_list})
        
    except Exception as e:
        return jsonify({'success': False, 'error': f'获取课程失败: {str(e)}'}), 500

@course_bp.route('/<course_id>', methods=['GET'])
@login_required
def get_course_detail(course_id):
    """获取课程详情"""
    try:
        course = models.Course.query.get(course_id)
        if not course:
            return jsonify({'success': False, 'error': '课程不存在'}), 404
        
        # 获取授课信息
        teaching = models.Teaching.query.filter_by(course_id=course_id).first()
        teacher = models.Teacher.query.get(teaching.teacher_id) if teaching else None
        
        # 获取选课学生数量
        enrollment_count = models.Enrollment.query.filter_by(
            course_id=course_id, 
            status='enrolled'
        ).count()
        
        course_data = {
            'course_id': course.course_id,
            'course_name': course.course_name,
            'credits': course.credits,
            'hours': course.hours,
            'type': course.type,
            'semester': course.semester,
            'description': course.description,
            'capacity': course.capacity,
            'current_enrollment': course.current_enrollment,
            'teacher_info': {
                'teacher_id': teacher.teacher_id if teacher else None,
                'name': teacher.name if teacher else '未分配',
                'title': teacher.title if teacher else None,
                'department': teacher.department if teacher else None
            },
            'teaching_info': {
                'class_no': teaching.class_no if teaching else None,
                'teaching_time': teaching.teaching_time if teaching else None,
                'location': teaching.location if teaching else None
            },
            'enrollment_count': enrollment_count,
            'created_at': course.created_at.isoformat() if course.created_at else None,
            'updated_at': course.updated_at.isoformat() if course.updated_at else None
        }
        
        return jsonify({'success': True, 'data': course_data})
        
    except Exception as e:
        return jsonify({'success': False, 'error': f'获取课程详情失败: {str(e)}'}), 500

@course_bp.route('/', methods=['POST'])
@teacher_only
def create_course():
    """创建课程（教师）"""
    try:
        data = request.get_json()
        
        # 验证必填字段
        required_fields = ['course_id', 'course_name', 'credits', 'hours', 'semester']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'error': f'{field}不能为空'}), 400
        
        # 检查课程是否已存在
        existing_course = models.Course.query.get(data['course_id'])
        if existing_course:
            return jsonify({'success': False, 'error': '课程ID已存在'}), 400
        
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
        
        # 如果是教师创建的课程，自动分配教学任务
        teacher_id = session.get('user_id')
        if teacher_id:
            teaching = models.Teaching(
                teacher_id=teacher_id,
                course_id=data['course_id'],
                teaching_time=data.get('teaching_time'),
                location=data.get('location'),
                class_no=data.get('class_no')
            )
            db.session.add(teaching)
        
        db.session.commit()
        
        # 记录日志
        log = models.AuditLog(
            user_id=teacher_id,
            action_type='create_course',
            description=f'创建课程: {data["course_name"]} ({data["course_id"]})',
            ip_address=request.remote_addr,
            result='success'
        )
        db.session.add(log)
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'message': '课程创建成功',
            'course_id': course.course_id
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': f'创建课程失败: {str(e)}'}), 500

@course_bp.route('/<course_id>', methods=['PUT'])
@teacher_only
def update_course(course_id):
    """更新课程信息"""
    try:
        course = models.Course.query.get(course_id)
        if not course:
            return jsonify({'success': False, 'error': '课程不存在'}), 404
        
        # 验证教师是否有权限修改此课程
        teacher_id = session.get('user_id')
        teaching = models.Teaching.query.filter_by(
            teacher_id=teacher_id,
            course_id=course_id
        ).first()
        
        if not teaching and session.get('role') != 'admin':
            return jsonify({'success': False, 'error': '没有权限修改此课程'}), 403
        
        data = request.get_json()
        
        # 更新允许修改的字段
        allowed_fields = ['course_name', 'description', 'capacity', 'teaching_time', 'location', 'class_no']
        for field in allowed_fields:
            if field in data and data[field] is not None:
                if field in ['course_name', 'description', 'teaching_time', 'location', 'class_no']:
                    setattr(course, field, data[field])
                elif field == 'capacity':
                    if int(data[field]) < course.current_enrollment:
                        return jsonify({'success': False, 'error': '容量不能小于当前选课人数'}), 400
                    course.capacity = int(data[field])
        
        # 更新教学任务信息
        if teaching:
            if 'teaching_time' in data and data['teaching_time']:
                teaching.teaching_time = data['teaching_time']
            if 'location' in data and data['location']:
                teaching.location = data['location']
            if 'class_no' in data and data['class_no']:
                teaching.class_no = data['class_no']
        
        course.updated_at = datetime.datetime.now()
        db.session.commit()
        
        # 记录日志
        log = models.AuditLog(
            user_id=teacher_id,
            action_type='update_course',
            description=f'更新课程信息: {course.course_name} ({course_id})',
            ip_address=request.remote_addr,
            result='success'
        )
        db.session.add(log)
        db.session.commit()
        
        return jsonify({'success': True, 'message': '课程更新成功'})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': f'更新课程失败: {str(e)}'}), 500

@course_bp.route('/<course_id>', methods=['DELETE'])
@admin_only
def delete_course(course_id):
    """删除课程（仅管理员）"""
    try:
        course = models.Course.query.get(course_id)
        if not course:
            return jsonify({'success': False, 'error': '课程不存在'}), 404
        
        # 检查是否有学生选课
        enrollments = models.Enrollment.query.filter_by(course_id=course_id).count()
        if enrollments > 0:
            return jsonify({'success': False, 'error': '该课程已有学生选课，无法删除'}), 400
        
        # 删除相关教学任务
        models.Teaching.query.filter_by(course_id=course_id).delete()
        
        # 删除课程
        db.session.delete(course)
        
        # 记录日志
        log = models.AuditLog(
            user_id=session.get('user_id'),
            action_type='delete_course',
            description=f'删除课程: {course.course_name} ({course_id})',
            ip_address=request.remote_addr,
            result='success'
        )
        db.session.add(log)
        db.session.commit()
        
        return jsonify({'success': True, 'message': '课程删除成功'})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': f'删除课程失败: {str(e)}'}), 500

@course_bp.route('/semesters', methods=['GET'])
@login_required
def get_semesters():
    """获取所有学期列表"""
    try:
        semesters = db.session.query(models.Course.semester)\
            .distinct()\
            .order_by(models.Course.semester.desc())\
            .all()
        
        semester_list = [semester[0] for semester in semesters]
        return jsonify({'success': True, 'data': semester_list})
        
    except Exception as e:
        return jsonify({'success': False, 'error': f'获取学期列表失败: {str(e)}'}), 500

@course_bp.route('/search', methods=['GET'])
@login_required
def search_courses():
    """搜索课程"""
    try:
        keyword = request.args.get('keyword', '').strip()
        semester = request.args.get('semester', '').strip()
        course_type = request.args.get('type', '').strip()
        
        query = models.Course.query
        
        if keyword:
            query = query.filter(
                models.Course.course_id.ilike(f'%{keyword}%') |
                models.Course.course_name.ilike(f'%{keyword}%')
            )
        
        if semester:
            query = query.filter(models.Course.semester == semester)
        
        if course_type:
            query = query.filter(models.Course.type == course_type)
        
        courses = query.order_by(models.Course.semester.desc(), models.Course.course_id).all()
        
        course_list = []
        for course in courses:
            teaching = models.Teaching.query.filter_by(course_id=course.course_id).first()
            teacher = models.Teacher.query.get(teaching.teacher_id) if teaching else None
            
            course_list.append({
                'course_id': course.course_id,
                'course_name': course.course_name,
                'credits': course.credits,
                'type': course.type,
                'semester': course.semester,
                'teacher_name': teacher.name if teacher else '未分配',
                'capacity': course.capacity,
                'current_enrollment': course.current_enrollment,
                'available_seats': course.capacity - course.current_enrollment
            })
        
        return jsonify({'success': True, 'data': course_list})
        
    except Exception as e:
        return jsonify({'success': False, 'error': f'搜索课程失败: {str(e)}'}), 500