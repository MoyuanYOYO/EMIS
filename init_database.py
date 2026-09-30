"""
init_database.py - 数据库初始化脚本
"""
import sys
import os
from sqlalchemy import text

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from backend.app import app, db
    from backend import models
    from backend.utils.security import SecurityUtils
    import datetime
    
    print("✓ 导入成功，开始初始化数据库...")
    
except ImportError as e:
    print(f"✗ 导入失败: {e}")
    print("请确保已安装所有依赖包，运行: pip install -r requirements.txt")
    sys.exit(1)

def init_database():
    """初始化数据库，创建默认用户"""
    with app.app_context():
        print("正在创建数据库表...")
        
        # 创建所有表
        db.create_all()
        print("✓ 数据库表创建完成")
        
        # 逐个检查并创建默认数据
        created_count = 0
        
        print("正在创建默认数据...")
        
        # 1. 管理员用户
        admin_user = models.User.query.get('admin001')
        if not admin_user:
            admin_user = models.User(
                user_id='admin001',
                username='admin',
                password_hash=SecurityUtils.hash_password('123456'),
                role='admin',
                status='active'
            )
            db.session.add(admin_user)
            created_count += 1
            print("  ✓ 创建管理员用户: admin / 123456")
        
        # 2. 教师用户
        teacher_user = models.User.query.get('T001')
        if not teacher_user:
            teacher_user = models.User(
                user_id='T001',
                username='huang_prof',
                password_hash=SecurityUtils.hash_password('123456'),
                role='teacher',
                status='active'
            )
            db.session.add(teacher_user)
            created_count += 1
            print("  ✓ 创建教师用户: huang_prof / 123456")
        
        # 3. 教师详细信息
        teacher = models.Teacher.query.get('T001')
        if not teacher:
            teacher = models.Teacher(
                teacher_id='T001',
                name='黄教授',
                gender='男',
                title='教授',
                department='计算机与电子信息学院',
                office='计算机楼301',
                phone='13800138000',
                email='teacher@example.edu.cn'
            )
            db.session.add(teacher)
            created_count += 1
            print("  ✓ 创建教师详细信息")
        
        # 4. 学生用户
        student_user = models.User.query.get('2023001')
        if not student_user:
            student_user = models.User(
                user_id='2023001',
                username='zhangsan',
                password_hash=SecurityUtils.hash_password('123456'),
                role='student',
                status='active'
            )
            db.session.add(student_user)
            created_count += 1
            print("  ✓ 创建学生用户: zhangsan / 123456")
        
        # 5. 学生详细信息
        student = models.Student.query.get('2023001')
        if not student:
            # 加密身份证和手机号
            encrypted_id_card = SecurityUtils.encrypt_data('110101200205151234')
            encrypted_phone = SecurityUtils.encrypt_data('13812345678')
            
            student = models.Student(
                student_id='2023001',
                name='张三',
                gender='男',
                birth_date=datetime.date(2002, 5, 15),
                id_card_encrypted=encrypted_id_card,
                phone_encrypted=encrypted_phone,
                email='zhangsan@student.edu.cn',
                department='计算机与电子信息学院',
                major='信息安全',
                enrollment_year=2023,
                status='active'
            )
            db.session.add(student)
            created_count += 1
            print("  ✓ 创建学生详细信息")
        
        # 6. 课程
        courses_data = [
            {
                'course_id': 'CS101',
                'course_name': '计算机基础',
                'credits': 3.0,
                'hours': 48,
                'type': 'compulsory',
                'semester': '2023-2024-1',
                'description': '计算机科学入门课程',
                'capacity': 60,
            },
            {
                'course_id': 'CS201',
                'course_name': '数据库原理',
                'credits': 3.5,
                'hours': 64,
                'type': 'compulsory',
                'semester': '2023-2024-1',
                'description': '数据库系统设计与实现',
                'capacity': 50,
            },
            {
                'course_id': 'EL101',
                'course_name': 'Web前端开发',
                'credits': 2.5,
                'hours': 40,
                'type': 'elective',
                'semester': '2023-2024-1',
                'description': 'HTML/CSS/JavaScript前端开发',
                'capacity': 45,
            }
        ]
        
        for course_info in courses_data:
            course = models.Course.query.get(course_info['course_id'])
            if not course:
                course = models.Course(**course_info)
                db.session.add(course)
                created_count += 1
                print(f"  ✓ 创建课程: {course_info['course_name']}")
        
        # 7. 教学任务
        teachings_data = [
            {
                'teacher_id': 'T001',
                'course_id': 'CS101',
                'teaching_time': '周一 1-2节, 周三 3-4节',
                'location': '教学楼201',
                'class_no': 'CS101-01'
            },
            {
                'teacher_id': 'T001',
                'course_id': 'CS201',
                'teaching_time': '周二 5-6节, 周四 7-8节',
                'location': '实验楼301',
                'class_no': 'CS201-01'
            },
            {
                'teacher_id': 'T001',
                'course_id': 'EL101',
                'teaching_time': '周五 1-4节',
                'location': '计算机楼402',
                'class_no': 'EL101-01'
            }
        ]
        
        for teaching_info in teachings_data:
            existing = models.Teaching.query.filter_by(
                teacher_id=teaching_info['teacher_id'],
                course_id=teaching_info['course_id'],
                class_no=teaching_info['class_no']
            ).first()
            
            if not existing:
                teaching = models.Teaching(**teaching_info)
                db.session.add(teaching)
                created_count += 1
                print(f"  ✓ 创建教学任务: {teaching_info['course_id']}")
        
        if created_count > 0:
            try:
                db.session.commit()
                print(f"\n✓ 成功创建了 {created_count} 条新记录")
                print("\n测试账户：")
                print("  管理员: admin / 123456")
                print("  教师: huang_prof / 123456")
                print("  学生: zhangsan / 123456")
            except Exception as e:
                db.session.rollback()
                print(f"✗ 提交失败: {e}")
                import traceback
                traceback.print_exc()
        else:
            print("\n✓ 所有默认数据已存在，无需创建")
        
        print("\n✓ 数据库初始化完成")

def check_existing_data():
    """检查现有数据"""
    with app.app_context():
        print("检查现有数据...")
        
        tables = {
            'users': models.User,
            'students': models.Student,
            'teachers': models.Teacher,
            'courses': models.Course,
            'teaching': models.Teaching,
            'enrollments': models.Enrollment,
            'audit_logs': models.AuditLog
        }
        
        for name, model in tables.items():
            count = db.session.query(model).count()
            print(f"  {name}: {count} 条记录")

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='数据库初始化工具')
    parser.add_argument('--check', action='store_true', help='只检查数据，不初始化')
    
    args = parser.parse_args()
    
    if args.check:
        check_existing_data()
    else:
        init_database()