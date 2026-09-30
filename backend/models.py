from datetime import datetime
from backend.app import db
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy import event

# 学生模型
class Student(db.Model):
    __tablename__ = 'students'
    
    student_id = db.Column(db.String(20), db.ForeignKey('users.user_id', ondelete='CASCADE'), primary_key=True, comment='学号')
    name = db.Column(db.String(50), nullable=False, comment='姓名')
    gender = db.Column(db.Enum('男', '女'), comment='性别')
    birth_date = db.Column(db.Date, comment='出生日期')
    id_card_encrypted = db.Column(db.String(255), nullable=False, comment='加密的身份证号')
    phone_encrypted = db.Column(db.String(255), comment='加密的手机号')
    email = db.Column(db.String(100), comment='邮箱')
    department = db.Column(db.String(50), comment='院系')
    major = db.Column(db.String(50), comment='专业')
    enrollment_year = db.Column(db.Integer, comment='入学年份')
    status = db.Column(db.Enum('active', 'leave', 'graduated'), default='active', comment='状态')
    created_at = db.Column(db.DateTime, default=datetime.now, comment='创建时间')
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now, comment='更新时间')
    
    # 关系
    enrollments = db.relationship('Enrollment', back_populates='student', cascade='all, delete-orphan')
    user = db.relationship(
        'User', 
        back_populates='student', 
        uselist=False, 
        foreign_keys='User.user_id', 
        primaryjoin='Student.student_id == User.user_id',
        overlaps="teacher,user",
        cascade='all, delete-orphan',  # 级联删除，删学生自动删关联用户
        passive_deletes=True           # 兼容MySQL外键检查，避免ORM与数据库规则冲突
    )
    
    def __repr__(self):
        return f'<Student {self.student_id}: {self.name}>'

# 教师模型
class Teacher(db.Model):
    __tablename__ = 'teachers'
    
    teacher_id = db.Column(db.String(20), db.ForeignKey('users.user_id', ondelete='CASCADE'), primary_key=True, comment='工号')
    name = db.Column(db.String(50), nullable=False, comment='姓名')
    gender = db.Column(db.Enum('男', '女'), comment='性别')
    title = db.Column(db.String(50), comment='职称')
    department = db.Column(db.String(50), comment='所属院系')
    office = db.Column(db.String(100), comment='办公室')
    phone = db.Column(db.String(20), comment='联系电话')
    email = db.Column(db.String(100), comment='邮箱')
    created_at = db.Column(db.DateTime, default=datetime.now, comment='创建时间')
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now, comment='更新时间')
    
    # 关系
    teaching = db.relationship('Teaching', back_populates='teacher', cascade='all, delete-orphan')
    user = db.relationship(
        'User', 
        back_populates='teacher',  # 注意你的反向引用是teacher
        uselist=False, 
        # 你的其他原有配置（foreign_keys/primaryjoin/overlaps）保留
        foreign_keys='User.user_id', 
        primaryjoin='Teacher.teacher_id == User.user_id',
        overlaps="student,user",
        cascade='all, delete-orphan',  # 删除教师时删关联用户
        passive_deletes=True           
    )
    
    def __repr__(self):
        return f'<Teacher {self.teacher_id}: {self.name}>'

# 课程模型
class Course(db.Model):
    __tablename__ = 'courses'
    
    course_id = db.Column(db.String(20), primary_key=True, comment='课程号')
    course_name = db.Column(db.String(100), nullable=False, comment='课程名称')
    credits = db.Column(db.Float, nullable=False, default=2.0, comment='学分')
    hours = db.Column(db.Integer, nullable=False, default=32, comment='学时')
    type = db.Column(db.Enum('compulsory', 'elective', 'general'), nullable=False, default='compulsory', comment='课程类型')
    semester = db.Column(db.String(20), nullable=False, comment='开课学期')
    description = db.Column(db.Text, comment='课程描述')
    capacity = db.Column(db.Integer, nullable=False, default=50, comment='最大容量')
    current_enrollment = db.Column(db.Integer, default=0, comment='当前选课人数')
    created_at = db.Column(db.DateTime, default=datetime.now, comment='创建时间')
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now, comment='更新时间')
    
    # 关系
    enrollments = db.relationship('Enrollment', back_populates='course', cascade='all, delete-orphan')
    teaching = db.relationship('Teaching', back_populates='course', cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Course {self.course_id}: {self.course_name}>'

# 用户模型
class User(db.Model):
    __tablename__ = 'users'
    
    user_id = db.Column(db.String(20), primary_key=True, comment='用户ID')
    username = db.Column(db.String(50), nullable=False, unique=True, comment='用户名')
    password_hash = db.Column(db.String(255), nullable=False, comment='加密的密码')
    role = db.Column(db.Enum('student', 'teacher', 'admin'), nullable=False, default='student', comment='角色')
    last_login = db.Column(db.DateTime, comment='上次登录时间')
    status = db.Column(db.Enum('active', 'inactive'), nullable=False, default='active', comment='状态')
    created_at = db.Column(db.DateTime, default=datetime.now, comment='创建时间')
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now, comment='更新时间')
    
    # 关系
    student = db.relationship('Student', back_populates='user', uselist=False,
                             foreign_keys=[user_id],
                             primaryjoin='User.user_id == Student.student_id',
                             overlaps="teacher")
    
    teacher = db.relationship('Teacher', back_populates='user', uselist=False,
                             foreign_keys=[user_id],
                             primaryjoin='User.user_id == Teacher.teacher_id',
                             overlaps="student")
    audit_logs = db.relationship('AuditLog', back_populates='user', cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<User {self.user_id}: {self.username}>'

# 选课/成绩模型
class Enrollment(db.Model):
    __tablename__ = 'enrollments'
    
    enrollment_id = db.Column(db.Integer, primary_key=True, autoincrement=True, comment='选课ID')
    student_id = db.Column(db.String(20), db.ForeignKey('students.student_id'), nullable=False, comment='学生ID')
    course_id = db.Column(db.String(20), db.ForeignKey('courses.course_id'), nullable=False, comment='课程ID')
    grade = db.Column(db.Float, comment='总成绩')
    grade_hash = db.Column(db.String(64), comment='成绩完整性校验哈希')
    regular_score = db.Column(db.Float, comment='平时成绩')
    final_score = db.Column(db.Float, comment='期末成绩')
    enroll_time = db.Column(db.DateTime, default=datetime.now, comment='选课时间')
    status = db.Column(db.Enum('enrolled', 'dropped', 'completed'), nullable=False, default='enrolled', comment='选课状态')
    created_at = db.Column(db.DateTime, default=datetime.now, comment='创建时间')
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now, comment='更新时间')
    
    # 关系
    student = db.relationship('Student', back_populates='enrollments')
    course = db.relationship('Course', back_populates='enrollments')
    
    # 唯一约束
    __table_args__ = (
        db.UniqueConstraint('student_id', 'course_id', name='uk_student_course'),
    )
    
    def __repr__(self):
        return f'<Enrollment {self.student_id} - {self.course_id}: {self.status}>'

# 教学任务模型
class Teaching(db.Model):
    __tablename__ = 'teaching'
    
    teaching_id = db.Column(db.Integer, primary_key=True, autoincrement=True, comment='教学任务ID')
    teacher_id = db.Column(db.String(20), db.ForeignKey('teachers.teacher_id'), nullable=False, comment='教师ID')
    course_id = db.Column(db.String(20), db.ForeignKey('courses.course_id'), nullable=False, comment='课程ID')
    teaching_time = db.Column(db.String(50), comment='授课时间')
    location = db.Column(db.String(100), comment='上课地点')
    class_no = db.Column(db.String(20), comment='教学班号')
    created_at = db.Column(db.DateTime, default=datetime.now, comment='创建时间')
    
    # 关系
    teacher = db.relationship('Teacher', back_populates='teaching')
    course = db.relationship('Course', back_populates='teaching')
    
    # 唯一约束
    __table_args__ = (
        db.UniqueConstraint('teacher_id', 'course_id', 'class_no', name='uk_teacher_course_class'),
    )
    
    def __repr__(self):
        return f'<Teaching {self.teacher_id} - {self.course_id}>'

# 操作日志模型
class AuditLog(db.Model):
    __tablename__ = 'audit_logs'
    
    log_id = db.Column(db.Integer, primary_key=True, autoincrement=True, comment='日志ID')
    user_id = db.Column(db.String(20), db.ForeignKey('users.user_id'), nullable=False, comment='用户ID')
    action_type = db.Column(db.String(50), nullable=False, comment='操作类型')
    description = db.Column(db.Text, comment='操作描述')
    ip_address = db.Column(db.String(45), comment='IP地址')
    result = db.Column(db.Enum('success', 'failure'), nullable=False, default='success', comment='操作结果')
    timestamp = db.Column(db.DateTime, default=datetime.now, comment='操作时间')
    
    # 关系
    user = db.relationship('User', back_populates='audit_logs')
    
    def __repr__(self):
        return f'<AuditLog {self.log_id}: {self.action_type}>'