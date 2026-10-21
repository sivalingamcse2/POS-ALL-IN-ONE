import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const defaultEmployees = [
  {
    id: 1,
    empCode: 'EMP001',
    fullName: 'Alice Brown',
    email: 'alice@company.com',
    phone: '+971501234567',
    gender: 'Female',
    nationality: 'UAE',
    department: 'Operations',
    designation: 'Manager',
    manager: '',
    joinDate: '2024-01-15',
    employmentStatus: 'Active',
    workLocation: 'Dubai',
    employeeType: 'Full Time',
    commissionRate: 0,
    commissionBasis: 'Monthly Sales',
    probationEnd: '2024-04-15',
    emergencyName: 'John Brown',
    emergencyPhone: '+971500000000',
    relationship: 'Spouse',
    passportNumber: 'P1234567',
    passportExpiry: '2029-07-20',
    emiratesId: '784-1999-1111111-1',
    emiratesIdExpiry: '2032-05-10',
    visaNumber: 'V-2024-123',
    visaExpiry: '2028-02-05',
    workPermitNumber: 'WP-98765',
    workPermitExpiry: '2027-08-14',
    address: 'Dubai Marina, Dubai',
    education: 'MBA',
    experience: '8 years in hospitality operations',
    documents: 'Passport, visa, degree copy',
    notes: 'Team lead for front-of-house leadership.'
  },
  {
    id: 2,
    empCode: 'EMP002',
    fullName: 'Bob Wilson',
    email: 'bob@company.com',
    phone: '+971551234567',
    gender: 'Male',
    nationality: 'UK',
    department: 'Service',
    designation: 'Waiter',
    manager: 'EMP001',
    joinDate: '2023-03-20',
    employmentStatus: 'Active',
    workLocation: 'Abu Dhabi',
    employeeType: 'Full Time',
    commissionRate: 0,
    commissionBasis: 'Monthly Sales',
    probationEnd: '2023-06-20',
    emergencyName: 'Emma Wilson',
    emergencyPhone: '+971555000111',
    relationship: 'Sibling',
    passportNumber: 'P7654321',
    passportExpiry: '2028-10-10',
    emiratesId: '784-1999-2222222-2',
    emiratesIdExpiry: '2031-11-11',
    visaNumber: 'V-2023-456',
    visaExpiry: '2027-01-18',
    workPermitNumber: 'WP-65432',
    workPermitExpiry: '2026-06-29',
    address: 'Abu Dhabi Corniche',
    education: 'Diploma in Tourism',
    experience: '3 years in guest service',
    documents: 'Passport, visa, police clearance',
    notes: 'Experienced waiter with strong customer support.'
  },
  {
    id: 3,
    empCode: 'EMP003',
    fullName: 'Carol Davis',
    email: 'carol@company.com',
    phone: '+971501112233',
    gender: 'Female',
    nationality: 'India',
    department: 'Kitchen',
    designation: 'Chef',
    manager: 'EMP001',
    joinDate: '2022-06-10',
    employmentStatus: 'Active',
    workLocation: 'Dubai',
    employeeType: 'Full Time',
    commissionRate: 0,
    commissionBasis: 'Monthly Sales',
    probationEnd: '2022-09-10',
    emergencyName: 'Rajan Davis',
    emergencyPhone: '+971500222333',
    relationship: 'Brother',
    passportNumber: 'P4567890',
    passportExpiry: '2027-04-22',
    emiratesId: '784-1999-3333333-3',
    emiratesIdExpiry: '2030-12-30',
    visaNumber: 'V-2022-999',
    visaExpiry: '2026-08-18',
    workPermitNumber: 'WP-11223',
    workPermitExpiry: '2026-03-03',
    address: 'Jebel Ali, Dubai',
    education: 'Certificate in Culinary Arts',
    experience: '7 years in kitchen operations',
    documents: 'Passport, visa, culinary certificate',
    notes: 'Responsible for quality control and prep planning.'
  }
];

const emptyEmployeeForm = () => ({
  empCode: '',
  fullName: '',
  email: '',
  phone: '',
  gender: 'Female',
  nationality: 'UAE',
  department: 'Operations',
  designation: 'Staff',
  manager: '',
  joinDate: new Date().toISOString().split('T')[0],
  employmentStatus: 'Active',
  workLocation: 'Dubai',
  employeeType: 'Full Time',
  commissionRate: 0,
  commissionBasis: 'Monthly Sales',
  probationEnd: '',
  emergencyName: '',
  emergencyPhone: '',
  relationship: '',
  passportNumber: '',
  passportExpiry: '',
  emiratesId: '',
  emiratesIdExpiry: '',
  visaNumber: '',
  visaExpiry: '',
  workPermitNumber: '',
  workPermitExpiry: '',
  address: '',
  education: '',
  experience: '',
  documents: '',
  notes: ''
});

export default function HRMS() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAttendanceForm, setShowAttendanceForm] = useState(false);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState(null);
  const [employeeForm, setEmployeeForm] = useState(emptyEmployeeForm());

  const [dateRange, setDateRange] = useState({
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
  });
  const [period, setPeriod] = useState('today');

  const [employees, setEmployees] = useState(() => {
    const saved = localStorage.getItem('pos_hrms_employees');
    if (saved) return JSON.parse(saved);
    localStorage.setItem('pos_hrms_employees', JSON.stringify(defaultEmployees));
    return defaultEmployees;
  });
  const [attendance, setAttendance] = useState(() => JSON.parse(localStorage.getItem('pos_attendance') || '[]'));
  const [leaves, setLeaves] = useState(() => JSON.parse(localStorage.getItem('pos_leaves') || '[]'));
  const [attendanceNotifications, setAttendanceNotifications] = useState(() => JSON.parse(localStorage.getItem('pos_hrms_attendance_notifications') || '[]'));

  useEffect(() => {
    localStorage.setItem('pos_hrms_employees', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('pos_attendance', JSON.stringify(attendance));
  }, [attendance]);

  useEffect(() => {
    localStorage.setItem('pos_hrms_attendance_notifications', JSON.stringify(attendanceNotifications));
  }, [attendanceNotifications]);

  useEffect(() => {
    localStorage.setItem('pos_leaves', JSON.stringify(leaves));
  }, [leaves]);

  const [attendanceForm, setAttendanceForm] = useState({
    employeeId: '',
    date: new Date().toISOString().split('T')[0],
    checkIn: '09:00',
    checkOut: '18:00',
    status: 'Present'
  });

  const [leaveForm, setLeaveForm] = useState({
    employeeId: '',
    leaveType: 'Annual Leave',
    startDate: '',
    endDate: '',
    reason: '',
    status: 'Pending'
  });

  const defaultCandidates = [
    {
      id: 1,
      candidateName: 'Sarah Khan',
      position: 'Front Office Supervisor',
      department: 'Operations',
      source: 'LinkedIn',
      applicationDate: '2026-08-16',
      interviewDate: '2026-08-22',
      status: 'Interviewing',
      contact: '+971500445566',
      email: 'sarah.khan@email.com',
      experience: '6 years hospitality management',
      salaryExpectation: 9000,
      notes: 'Strong guest service leadership and Arabic communication.'
    },
    {
      id: 2,
      candidateName: 'David Martins',
      position: 'Chef de Partie',
      department: 'Kitchen',
      source: 'Referral',
      applicationDate: '2026-08-18',
      interviewDate: '2026-08-24',
      status: 'Shortlisted',
      contact: '+971501998877',
      email: 'david.martins@email.com',
      experience: '5 years fine dining kitchen',
      salaryExpectation: 7000,
      notes: 'Excellent plating and menu execution.'
    },
    {
      id: 3,
      candidateName: 'Nadia Ali',
      position: 'HR Executive',
      department: 'HR',
      source: 'Career Portal',
      applicationDate: '2026-08-20',
      interviewDate: '2026-08-26',
      status: 'Applied',
      contact: '+971555119922',
      email: 'nadia.ali@email.com',
      experience: '3 years HR operations',
      salaryExpectation: 6500,
      notes: 'Experience with UAE labor documentation.'
    }
  ];

  const [recruitmentForm, setRecruitmentForm] = useState({
    candidateName: '',
    position: '',
    department: 'Operations',
    source: 'Career Portal',
    applicationDate: new Date().toISOString().split('T')[0],
    interviewDate: '',
    status: 'Applied',
    contact: '',
    email: '',
    experience: '',
    salaryExpectation: 0,
    notes: ''
  });
  const [showRecruitmentForm, setShowRecruitmentForm] = useState(false);
  const [editingCandidateId, setEditingCandidateId] = useState(null);
  const [candidates, setCandidates] = useState(() => {
    const saved = localStorage.getItem('pos_hrms_candidates');
    if (saved) return JSON.parse(saved);
    localStorage.setItem('pos_hrms_candidates', JSON.stringify(defaultCandidates));
    return defaultCandidates;
  });

  useEffect(() => {
    localStorage.setItem('pos_hrms_candidates', JSON.stringify(candidates));
  }, [candidates]);

  const defaultPerformanceReviews = [
    {
      id: 1,
      employeeId: 'EMP001',
      reviewPeriod: '2026 H1',
      reviewDate: '2026-06-30',
      reviewer: 'General Manager',
      rating: 4,
      goals: 'Improve branch profitability and team retention',
      strengths: 'Leadership, guest recovery, team coaching',
      developmentPlan: 'Advanced financial management course',
      status: 'Completed'
    },
    {
      id: 2,
      employeeId: 'EMP002',
      reviewPeriod: '2026 H1',
      reviewDate: '2026-06-30',
      reviewer: 'Operations Manager',
      rating: 3,
      goals: 'Increase table service speed and upselling',
      strengths: 'Guest communication and reliability',
      developmentPlan: 'Advanced service and upselling training',
      status: 'In Progress'
    }
  ];

  const defaultTrainingRecords = [
    {
      id: 1,
      employeeId: 'EMP003',
      course: 'Food Safety Level 3',
      provider: 'Dubai Municipality',
      startDate: '2026-09-12',
      completionDate: '2026-09-14',
      status: 'Scheduled',
      cost: 850,
      certificateExpiry: '2028-09-14'
    },
    {
      id: 2,
      employeeId: 'EMP002',
      course: 'Guest Experience Excellence',
      provider: 'Internal Academy',
      startDate: '2026-07-08',
      completionDate: '2026-07-08',
      status: 'Completed',
      cost: 0,
      certificateExpiry: ''
    }
  ];

  const [performanceForm, setPerformanceForm] = useState({
    employeeId: '',
    reviewPeriod: '2026 H2',
    reviewDate: new Date().toISOString().split('T')[0],
    reviewer: '',
    rating: 3,
    goals: '',
    strengths: '',
    developmentPlan: '',
    status: 'Draft'
  });
  const [trainingForm, setTrainingForm] = useState({
    employeeId: '',
    course: '',
    provider: '',
    startDate: '',
    completionDate: '',
    status: 'Planned',
    cost: 0,
    certificateExpiry: ''
  });
  const [showPerformanceForm, setShowPerformanceForm] = useState(false);
  const [showTrainingForm, setShowTrainingForm] = useState(false);
  const [editingPerformanceId, setEditingPerformanceId] = useState(null);
  const [editingTrainingId, setEditingTrainingId] = useState(null);
  const [performanceReviews, setPerformanceReviews] = useState(() => {
    const saved = localStorage.getItem('pos_hrms_performance');
    if (saved) return JSON.parse(saved);
    localStorage.setItem('pos_hrms_performance', JSON.stringify(defaultPerformanceReviews));
    return defaultPerformanceReviews;
  });
  const [trainingRecords, setTrainingRecords] = useState(() => {
    const saved = localStorage.getItem('pos_hrms_training');
    if (saved) return JSON.parse(saved);
    localStorage.setItem('pos_hrms_training', JSON.stringify(defaultTrainingRecords));
    return defaultTrainingRecords;
  });

  useEffect(() => {
    localStorage.setItem('pos_hrms_performance', JSON.stringify(performanceReviews));
  }, [performanceReviews]);

  useEffect(() => {
    localStorage.setItem('pos_hrms_training', JSON.stringify(trainingRecords));
  }, [trainingRecords]);

  const defaultPayroll = [
    {
      id: 1,
      employeeId: 'EMP001',
      month: '2026-09',
      basicSalary: 12000,
      allowances: 2500,
      overtime: 800,
      bonus: 1000,
      commission: 0,
      deductions: 900,
      loan: 0,
      bankName: 'Emirates NBD',
      iban: 'AE460331234567890123456',
      wpsStatus: 'Ready',
      paymentMode: 'Bank Transfer',
      notes: 'Monthly payroll approved.'
    },
    {
      id: 2,
      employeeId: 'EMP002',
      month: '2026-09',
      basicSalary: 4300,
      allowances: 700,
      overtime: 350,
      bonus: 200,
      commission: 150,
      deductions: 260,
      loan: 0,
      bankName: 'Mashreq Bank',
      iban: 'AE120331234567890123457',
      wpsStatus: 'Ready',
      paymentMode: 'Bank Transfer',
      notes: 'Service incentive included.'
    },
    {
      id: 3,
      employeeId: 'EMP003',
      month: '2026-09',
      basicSalary: 7800,
      allowances: 1500,
      overtime: 600,
      bonus: 500,
      commission: 0,
      deductions: 520,
      loan: 0,
      bankName: 'ADCB',
      iban: 'AE330331234567890123458',
      wpsStatus: 'Ready',
      paymentMode: 'Bank Transfer',
      notes: 'Kitchen premium included.'
    }
  ];

  const [payrollForm, setPayrollForm] = useState({
    employeeId: '',
    month: new Date().toISOString().slice(0, 7),
    basicSalary: 0,
    allowances: 0,
    overtime: 0,
    bonus: 0,
    commission: 0,
    commissionBase: 0,
    commissionRate: 0,
    deductions: 0,
    loan: 0,
    bankName: '',
    iban: '',
    wpsStatus: 'Ready',
    paymentMode: 'Bank Transfer',
    notes: ''
  });
  const [showPayrollForm, setShowPayrollForm] = useState(false);
  const [selectedPayrollMonth, setSelectedPayrollMonth] = useState(new Date().toISOString().slice(0, 7));
  const [payrollRecords, setPayrollRecords] = useState(() => {
    const saved = localStorage.getItem('pos_hrms_payroll');
    if (saved) return JSON.parse(saved);
    localStorage.setItem('pos_hrms_payroll', JSON.stringify(defaultPayroll));
    return defaultPayroll;
  });

  const calculatedPayrollCommission = useMemo(() => {
    const commissionBase = Number(payrollForm.commissionBase || 0);
    const commissionRate = Number(payrollForm.commissionRate || 0);
    return commissionBase > 0 && commissionRate > 0
      ? (commissionBase * commissionRate) / 100
      : Number(payrollForm.commission || 0);
  }, [payrollForm.commission, payrollForm.commissionBase, payrollForm.commissionRate]);

  useEffect(() => {
    localStorage.setItem('pos_hrms_payroll', JSON.stringify(payrollRecords));
  }, [payrollRecords]);

  const handlePeriodChange = (p) => {
    setPeriod(p);
    if (p === 'all' || p === 'custom') return;
    const today = new Date();
    let start = new Date();
    let end = new Date();

    if (p === 'today') {
      start = today; end = today;
    } else if (p === 'yesterday') {
      start = new Date(today); start.setDate(today.getDate() - 1); end = new Date(start);
    } else if (p === 'this_month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1); end = today;
    } else if (p === 'last_month') {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1); end = new Date(today.getFullYear(), today.getMonth(), 0);
    }

    setDateRange({
      start_date: start.toISOString().split('T')[0],
      end_date: end.toISOString().split('T')[0]
    });
  };

  const hasValidDateRange = Boolean(
    dateRange.start_date
    && dateRange.end_date
    && dateRange.start_date <= dateRange.end_date
  );

  const isWithinDateRange = (value) => {
    if (period === 'all') return true;
    if (!hasValidDateRange || !value) return false;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return dateKey >= dateRange.start_date && dateKey <= dateRange.end_date;
  };

  const getReportData = () => {
    if (activeTab === 'dashboard') {
      return {
        headers: ['Metric', 'Value'],
        rows: [
          ['Total Employees', dashboardStats.totalEmployees],
          ['Active Employees', dashboardStats.activeEmployees],
          ['Present Today', dashboardStats.presentToday],
          ['Pending Leaves', dashboardStats.pendingLeaves],
          ['Expiring Soon', dashboardStats.expiringSoon],
        ],
      };
    }
    if (activeTab === 'attendance') {
      return {
        headers: ['Employee ID', 'Name', 'Date', 'Check In', 'Check Out', 'Status'],
        rows: filteredAttendance.map((record) => [
          record.employeeId, record.employeeName, record.date, record.checkIn, record.checkOut, record.status,
        ]),
      };
    }
    if (activeTab === 'leaves') {
      const rows = filteredLeaves.filter((leave) => (
        period === 'all'
        || hasValidDateRange
          && String(leave.startDate || '') <= dateRange.end_date
          && String(leave.endDate || leave.startDate || '') >= dateRange.start_date
      ));
      return {
        headers: ['Employee ID', 'Name', 'Leave Type', 'Start Date', 'End Date', 'Status'],
        rows: rows.map((leave) => [
          leave.employeeId, leave.employeeName, leave.leaveType, leave.startDate, leave.endDate, leave.status,
        ]),
      };
    }
    if (activeTab === 'employees') {
      const rows = filteredEmployees.filter((employee) => period === 'all' || isWithinDateRange(employee.joinDate));
      return {
        headers: ['Employee ID', 'Name', 'Department', 'Designation', 'Status', 'Location', 'Join Date'],
        rows: rows.map((employee) => [
          employee.empCode, employee.fullName, employee.department, employee.designation,
          employee.employmentStatus, employee.workLocation, employee.joinDate,
        ]),
      };
    }
    if (activeTab === 'recruitment') {
      const rows = filteredCandidates.filter((candidate) => period === 'all' || isWithinDateRange(candidate.applicationDate));
      return {
        headers: ['Candidate', 'Position', 'Department', 'Application Date', 'Interview Date', 'Status', 'Email', 'Contact'],
        rows: rows.map((candidate) => [
          candidate.candidateName, candidate.position, candidate.department, candidate.applicationDate,
          candidate.interviewDate, candidate.status, candidate.email, candidate.contact,
        ]),
      };
    }
    if (activeTab === 'performance') {
      const rows = performanceRows.filter((review) => period === 'all' || isWithinDateRange(review.reviewDate));
      return {
        headers: ['Employee ID', 'Name', 'Review Period', 'Review Date', 'Reviewer', 'Rating', 'Status'],
        rows: rows.map((review) => [
          review.employeeId, review.employeeName, review.reviewPeriod, review.reviewDate,
          review.reviewer, review.rating, review.status,
        ]),
      };
    }
    const rows = payrollRecords.filter((record) => (
      period === 'all'
      || hasValidDateRange
        && record.month >= dateRange.start_date.slice(0, 7)
        && record.month <= dateRange.end_date.slice(0, 7)
    ));
    return {
      headers: ['Employee ID', 'Month', 'Basic Salary', 'Allowances', 'Overtime', 'Bonus', 'Commission', 'Deductions', 'Loan', 'Net Pay', 'WPS Status', 'Payment Mode'],
      rows: rows.map((record) => [
        record.employeeId, record.month, record.basicSalary, record.allowances, record.overtime, record.bonus,
        record.commission, record.deductions, record.loan,
        Number(record.basicSalary || 0) + Number(record.allowances || 0) + Number(record.overtime || 0)
          + Number(record.bonus || 0) + Number(record.commission || 0)
          - Number(record.deductions || 0) - Number(record.loan || 0),
        record.wpsStatus, record.paymentMode,
      ]),
    };
  };

  const filteredAttendance = useMemo(() => {
    const start = new Date(dateRange.start_date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dateRange.end_date);
    end.setHours(23, 59, 59, 999);

    return attendance.filter((a) => {
      const aDate = new Date(a.date);
      const matchesDate = period === 'all' || (aDate >= start && aDate <= end);
      const emp = employees.find((e) => e.empCode === a.employeeId);
      const matchesSearch = !searchTerm ||
        (emp?.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.employeeId.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesDate && matchesSearch;
    }).map((a) => ({
      ...a,
      employeeName: employees.find((e) => e.empCode === a.employeeId)?.fullName || 'Unknown'
    }));
  }, [attendance, dateRange, period, searchTerm, employees]);

  const attendanceAiInsight = useMemo(() => {
    const records = attendance.filter((record) => period === 'all' || record.date >= dateRange.start_date && record.date <= dateRange.end_date);
    const lateRecords = records.filter((record) => record.status === 'Late');
    const absentRecords = records.filter((record) => record.status === 'Absent');
    const byEmployee = lateRecords.reduce((summary, record) => {
      summary[record.employeeId] = (summary[record.employeeId] || 0) + 1;
      return summary;
    }, {});
    const topLateEmployee = Object.entries(byEmployee).sort((a, b) => b[1] - a[1])[0];
    const employee = topLateEmployee ? employees.find((item) => item.empCode === topLateEmployee[0]) : null;

    if (!records.length) return 'No attendance data is available for this period yet.';
    if (lateRecords.length || absentRecords.length) {
      return `${lateRecords.length} late and ${absentRecords.length} absent record${lateRecords.length + absentRecords.length === 1 ? '' : 's'} found. ${employee ? `${employee.fullName} has the most late arrivals (${topLateEmployee[1]}).` : 'Review the flagged records and follow up through WhatsApp.'}`;
    }
    return 'Attendance is on track for this period. No late or absent patterns detected.';
  }, [attendance, dateRange, employees, period]);

  const getWhatsAppUrl = (phone, message) => {
    const normalizedPhone = (phone || '').replace(/\D/g, '');
    if (!normalizedPhone) return '';
    return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
  };

  const sendAttendanceWhatsApp = (record) => {
    const employee = employees.find((item) => item.empCode === record.employeeId);
    if (!employee?.phone) {
      window.alert('This employee does not have a phone number for WhatsApp.');
      return;
    }

    const statusMessage = record.status === 'Late'
      ? `Hello ${employee.fullName}, HRMS recorded your attendance as LATE on ${record.date}. Check-in: ${record.checkIn}. Please contact HR if this needs correction.`
      : record.status === 'Absent'
        ? `Hello ${employee.fullName}, HRMS recorded your attendance as ABSENT on ${record.date}. Please contact HR to update the record.`
        : `Hello ${employee.fullName}, your attendance was recorded as PRESENT on ${record.date}. Check-in: ${record.checkIn}. Thank you.`;
    const url = getWhatsAppUrl(employee.phone, statusMessage);
    if (!url) return;

    setAttendanceNotifications((prev) => [{
      id: Date.now(),
      employeeId: record.employeeId,
      employeeName: employee.fullName,
      date: record.date,
      status: record.status,
      channel: 'WhatsApp',
      createdAt: new Date().toISOString()
    }, ...prev].slice(0, 50));
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const filteredLeaves = useMemo(() => {
    return leaves.filter((l) => {
      const emp = employees.find((e) => e.empCode === l.employeeId);
      return !searchTerm ||
        (emp?.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.employeeId.toLowerCase().includes(searchTerm.toLowerCase());
    }).map((l) => ({
      ...l,
      employeeName: employees.find((e) => e.empCode === l.employeeId)?.fullName || 'Unknown'
    }));
  }, [leaves, searchTerm, employees]);

  const filteredCandidates = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return candidates.filter((candidate) => {
      const haystack = [candidate.candidateName, candidate.position, candidate.department, candidate.status, candidate.source].join(' ').toLowerCase();
      return !term || haystack.includes(term);
    });
  }, [candidates, searchTerm]);

  const recruitmentSummary = useMemo(() => {
    const applied = candidates.filter((candidate) => candidate.status === 'Applied').length;
    const shortlisted = candidates.filter((candidate) => candidate.status === 'Shortlisted').length;
    const interviewing = candidates.filter((candidate) => candidate.status === 'Interviewing').length;
    const hired = candidates.filter((candidate) => candidate.status === 'Hired').length;

    return { applied, shortlisted, interviewing, hired };
  }, [candidates]);

  const performanceRows = useMemo(() => performanceReviews.map((review) => ({
    ...review,
    employeeName: employees.find((employee) => employee.empCode === review.employeeId)?.fullName || 'Unknown'
  })).filter((review) => {
    const term = searchTerm.toLowerCase();
    return !term || [review.employeeId, review.employeeName, review.reviewPeriod, review.reviewer, review.status].join(' ').toLowerCase().includes(term);
  }), [employees, performanceReviews, searchTerm]);

  const trainingRows = useMemo(() => trainingRecords.map((training) => ({
    ...training,
    employeeName: employees.find((employee) => employee.empCode === training.employeeId)?.fullName || 'Unknown'
  })).filter((training) => {
    const term = searchTerm.toLowerCase();
    return !term || [training.employeeId, training.employeeName, training.course, training.provider, training.status].join(' ').toLowerCase().includes(term);
  }), [employees, searchTerm, trainingRecords]);

  const performanceSummary = useMemo(() => ({
    totalReviews: performanceReviews.length,
    completed: performanceReviews.filter((review) => review.status === 'Completed').length,
    averageRating: performanceReviews.length
      ? (performanceReviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / performanceReviews.length).toFixed(1)
      : '0.0',
    trainingCompleted: trainingRecords.filter((training) => training.status === 'Completed').length
  }), [performanceReviews, trainingRecords]);

  const filteredEmployees = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return employees.filter((emp) => {
      const haystack = [emp.fullName, emp.empCode, emp.department, emp.designation, emp.email].join(' ').toLowerCase();
      return !term || haystack.includes(term);
    });
  }, [employees, searchTerm]);

  const today = new Date().toISOString().split('T')[0];

  const dashboardStats = useMemo(() => {
    const totalEmployees = employees.length;
    const activeEmployees = employees.filter((emp) => emp.employmentStatus === 'Active').length;
    const presentToday = attendance.filter((record) => record.date === today && record.status === 'Present').length;
    const pendingLeaves = leaves.filter((leave) => leave.status === 'Pending').length;
    const expiringSoon = employees.filter((emp) => {
      const dates = [emp.passportExpiry, emp.visaExpiry, emp.emiratesIdExpiry, emp.workPermitExpiry].filter(Boolean);
      return dates.some((date) => {
        if (!date) return false;
        const diff = new Date(date) - new Date();
        const days = diff / (1000 * 60 * 60 * 24);
        return days > 0 && days <= 90;
      });
    }).length;

    return { totalEmployees, activeEmployees, presentToday, pendingLeaves, expiringSoon };
  }, [employees, attendance, leaves, today]);

  const upcomingExpiries = useMemo(() => {
    return employees
      .map((emp) => {
        const items = [
          { label: 'Passport', value: emp.passportExpiry },
          { label: 'Visa', value: emp.visaExpiry },
          { label: 'Emirates ID', value: emp.emiratesIdExpiry },
          { label: 'Work Permit', value: emp.workPermitExpiry },
        ].filter((item) => item.value);
        return items.map((item) => ({
          employee: emp.fullName,
          empCode: emp.empCode,
          type: item.label,
          expiry: item.value,
        }));
      })
      .flat()
      .sort((a, b) => new Date(a.expiry) - new Date(b.expiry))
      .slice(0, 5);
  }, [employees]);

  const handleEmployeeSubmit = (e) => {
    e.preventDefault();

    const payload = {
      ...employeeForm,
      fullName: employeeForm.fullName.trim(),
      email: employeeForm.email.trim(),
      phone: employeeForm.phone.trim(),
      commissionRate: Number(employeeForm.commissionRate || 0),
      notes: employeeForm.notes.trim(),
      documents: employeeForm.documents.trim(),
    };

    if (editingEmployeeId) {
      setEmployees((prev) => prev.map((emp) => emp.id === editingEmployeeId ? { ...emp, ...payload } : emp));
    } else {
      const lastId = employees.length ? Math.max(...employees.map((emp) => emp.id)) : 0;
      const nextId = lastId + 1;
      const empCode = payload.empCode || `EMP${String(nextId).padStart(3, '0')}`;
      setEmployees((prev) => [...prev, { id: nextId, ...payload, empCode }]);
    }

    setShowEmployeeForm(false);
    setEditingEmployeeId(null);
    setEmployeeForm(emptyEmployeeForm());
  };

  const handleEditEmployee = (employee) => {
    setEmployeeForm(employee);
    setEditingEmployeeId(employee.id);
    setShowEmployeeForm(true);
  };

  const handleDeleteEmployee = (id) => {
    if (window.confirm('Delete this employee record from HRMS?')) {
      setEmployees((prev) => prev.filter((emp) => emp.id !== id));
    }
  };

  const handleMarkAttendance = (e) => {
    e.preventDefault();
    const newRecord = { ...attendanceForm, id: Date.now() };
    setAttendance((prev) => [newRecord, ...prev]);
    setShowAttendanceForm(false);
    setAttendanceForm({
      employeeId: '',
      date: new Date().toISOString().split('T')[0],
      checkIn: '09:00',
      checkOut: '18:00',
      status: 'Present'
    });
  };

  const handleLeaveRequest = (e) => {
    e.preventDefault();
    const newLeave = { ...leaveForm, id: Date.now() };
    setLeaves((prev) => [newLeave, ...prev]);
    setShowLeaveForm(false);
    setLeaveForm({
      employeeId: '',
      leaveType: 'Annual Leave',
      startDate: '',
      endDate: '',
      reason: '',
      status: 'Pending'
    });
  };

  const updateLeaveStatus = (id, status) => {
    setLeaves((prev) => prev.map((leave) => leave.id === id ? { ...leave, status } : leave));
  };

  const handleRecruitmentSubmit = (e) => {
    e.preventDefault();

    const payload = {
      ...recruitmentForm,
      candidateName: recruitmentForm.candidateName.trim(),
      position: recruitmentForm.position.trim(),
      email: recruitmentForm.email.trim(),
      contact: recruitmentForm.contact.trim(),
      notes: recruitmentForm.notes.trim(),
      salaryExpectation: Number(recruitmentForm.salaryExpectation || 0),
    };

    if (editingCandidateId) {
      setCandidates((prev) => prev.map((candidate) => candidate.id === editingCandidateId ? { ...candidate, ...payload } : candidate));
    } else {
      const nextId = candidates.length ? Math.max(...candidates.map((candidate) => candidate.id)) + 1 : 1;
      setCandidates((prev) => [{ id: nextId, ...payload }, ...prev]);
    }

    setShowRecruitmentForm(false);
    setEditingCandidateId(null);
    setRecruitmentForm({
      candidateName: '',
      position: '',
      department: 'Operations',
      source: 'Career Portal',
      applicationDate: new Date().toISOString().split('T')[0],
      interviewDate: '',
      status: 'Applied',
      contact: '',
      email: '',
      experience: '',
      salaryExpectation: 0,
      notes: ''
    });
  };

  const handleEditCandidate = (candidate) => {
    setRecruitmentForm(candidate);
    setEditingCandidateId(candidate.id);
    setShowRecruitmentForm(true);
  };

  const handleDeleteCandidate = (id) => {
    if (window.confirm('Delete this candidate from recruitment pipeline?')) {
      setCandidates((prev) => prev.filter((candidate) => candidate.id !== id));
    }
  };

  const handlePerformanceSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...performanceForm,
      rating: Number(performanceForm.rating),
      goals: performanceForm.goals.trim(),
      strengths: performanceForm.strengths.trim(),
      developmentPlan: performanceForm.developmentPlan.trim(),
    };

    if (editingPerformanceId) {
      setPerformanceReviews((prev) => prev.map((review) => review.id === editingPerformanceId ? { ...review, ...payload } : review));
    } else {
      const nextId = performanceReviews.length ? Math.max(...performanceReviews.map((review) => review.id)) + 1 : 1;
      setPerformanceReviews((prev) => [{ id: nextId, ...payload }, ...prev]);
    }
    setShowPerformanceForm(false);
    setEditingPerformanceId(null);
  };

  const handleTrainingSubmit = (e) => {
    e.preventDefault();
    const payload = { ...trainingForm, cost: Number(trainingForm.cost || 0) };

    if (editingTrainingId) {
      setTrainingRecords((prev) => prev.map((training) => training.id === editingTrainingId ? { ...training, ...payload } : training));
    } else {
      const nextId = trainingRecords.length ? Math.max(...trainingRecords.map((training) => training.id)) + 1 : 1;
      setTrainingRecords((prev) => [{ id: nextId, ...payload }, ...prev]);
    }
    setShowTrainingForm(false);
    setEditingTrainingId(null);
  };

  const deletePerformanceReview = (id) => {
    if (window.confirm('Delete this performance review?')) {
      setPerformanceReviews((prev) => prev.filter((review) => review.id !== id));
    }
  };

  const deleteTrainingRecord = (id) => {
    if (window.confirm('Delete this training record?')) {
      setTrainingRecords((prev) => prev.filter((training) => training.id !== id));
    }
  };

  const payrollSummary = useMemo(() => {
    const monthRecords = payrollRecords.filter((entry) => entry.month === selectedPayrollMonth);
    const totalBasic = monthRecords.reduce((sum, entry) => sum + Number(entry.basicSalary || 0), 0);
    const totalAllowances = monthRecords.reduce((sum, entry) => sum + Number(entry.allowances || 0), 0);
    const totalOvertime = monthRecords.reduce((sum, entry) => sum + Number(entry.overtime || 0), 0);
    const totalBonus = monthRecords.reduce((sum, entry) => sum + Number(entry.bonus || 0), 0);
    const totalCommission = monthRecords.reduce((sum, entry) => sum + Number(entry.commission || 0), 0);
    const totalDeductions = monthRecords.reduce((sum, entry) => sum + Number(entry.deductions || 0), 0);
    const totalLoan = monthRecords.reduce((sum, entry) => sum + Number(entry.loan || 0), 0);
    const totalGross = totalBasic + totalAllowances + totalOvertime + totalBonus + totalCommission;
    const totalNet = totalGross - totalDeductions - totalLoan;

    return {
      totalBasic,
      totalAllowances,
      totalOvertime,
      totalBonus,
      totalCommission,
      totalDeductions,
      totalLoan,
      totalGross,
      totalNet,
      totalEmployees: monthRecords.length,
    };
  }, [payrollRecords, selectedPayrollMonth]);

  const filteredPayroll = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return payrollRecords
      .filter((entry) => entry.month === selectedPayrollMonth)
      .map((entry) => {
        const employee = employees.find((item) => item.empCode === entry.employeeId);
        const gross = Number(entry.basicSalary || 0) + Number(entry.allowances || 0) + Number(entry.overtime || 0) + Number(entry.bonus || 0) + Number(entry.commission || 0);
        const net = gross - Number(entry.deductions || 0) - Number(entry.loan || 0);
        return {
          ...entry,
          employeeName: employee?.fullName || 'Unknown',
          department: employee?.department || '—',
          designation: employee?.designation || '—',
          gross,
          net,
        };
      })
      .filter((entry) => !term || [entry.employeeId, entry.employeeName, entry.department, entry.designation].join(' ').toLowerCase().includes(term));
  }, [employees, payrollRecords, searchTerm, selectedPayrollMonth]);

  const handlePayrollSubmit = (e) => {
    e.preventDefault();

    const payload = {
      ...payrollForm,
      employeeId: payrollForm.employeeId,
      basicSalary: Number(payrollForm.basicSalary || 0),
      allowances: Number(payrollForm.allowances || 0),
      overtime: Number(payrollForm.overtime || 0),
      bonus: Number(payrollForm.bonus || 0),
      commission: calculatedPayrollCommission,
      commissionBase: Number(payrollForm.commissionBase || 0),
      commissionRate: Number(payrollForm.commissionRate || 0),
      deductions: Number(payrollForm.deductions || 0),
      loan: Number(payrollForm.loan || 0),
      month: payrollForm.month,
      notes: payrollForm.notes.trim(),
    };

    const exists = payrollRecords.find((record) => record.employeeId === payload.employeeId && record.month === payload.month);

    if (exists) {
      setPayrollRecords((prev) => prev.map((record) => record.id === exists.id ? { ...record, ...payload } : record));
    } else {
      setPayrollRecords((prev) => [{
        id: Date.now(),
        ...payload,
      }, ...prev]);
    }

    setShowPayrollForm(false);
    setPayrollForm({
      employeeId: '',
      month: new Date().toISOString().slice(0, 7),
      basicSalary: 0,
      allowances: 0,
      overtime: 0,
      bonus: 0,
      commission: 0,
      commissionBase: 0,
      commissionRate: 0,
      deductions: 0,
      loan: 0,
      bankName: '',
      iban: '',
      wpsStatus: 'Ready',
      paymentMode: 'Bank Transfer',
      notes: ''
    });
  };

  const exportToExcel = () => {
    const { headers, rows } = getReportData();
    const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csvContent = `\uFEFF${[headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n')}`;
    const blobUrl = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `hrms_${activeTab}_report_${period === 'all' ? 'all-time' : `${dateRange.start_date}_to_${dateRange.end_date}`}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  };

  const exportToPDF = () => {
    const printWindow = window.open('', '', 'width=900,height=700');
    if (!printWindow) {
      window.alert('Allow pop-ups to open the HRMS report for printing or PDF saving.');
      return;
    }
    const { headers, rows } = getReportData();
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[character]));
    const tableHeader = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('');
    const rowMarkup = rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('');
    const periodLabel = period === 'all' ? 'All Time' : `${dateRange.start_date} to ${dateRange.end_date}`;

    const content = `
      <html>
        <head>
          <title>HRMS Report</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f8f9fa; }
            .header { text-align: center; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>HRMS ${activeTab.toUpperCase()} Report</h1>
            <p>Period: ${escapeHtml(periodLabel)}</p>
          </div>
          <table><thead><tr>${tableHeader}</tr></thead><tbody>${rowMarkup || `<tr><td colspan="${headers.length}">No records found for this date range.</td></tr>`}</tbody></table>
        </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-blue-600 font-bold">HRMS</p>
          <h1 className="text-3xl font-bold text-gray-800">Human Resource Management</h1>
        </div>
        <div className="flex gap-3">
          <button onClick={exportToExcel} disabled={period !== 'all' && !hasValidDateRange} className="btn bg-green-600 text-white disabled:cursor-not-allowed disabled:opacity-50">Excel</button>
          <button onClick={exportToPDF} disabled={period !== 'all' && !hasValidDateRange} className="btn bg-red-600 text-white disabled:cursor-not-allowed disabled:opacity-50">PDF</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        {['dashboard', 'employees', 'attendance', 'leaves', 'recruitment', 'performance', 'payroll'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 rounded-lg font-medium capitalize transition-colors ${
              activeTab === tab ? 'bg-primary-600 text-white shadow-md' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            {tab === 'dashboard' ? 'Dashboard' : tab === 'employees' ? 'Employees' : tab === 'attendance' ? 'Attendance' : tab === 'leaves' ? 'Leave' : tab === 'recruitment' ? 'Recruitment' : tab === 'performance' ? 'Performance' : 'Payroll'}
          </button>
        ))}
      </div>

      <div className="card mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-2 block font-medium text-gray-700">Quick Period</label>
            <select value={period} onChange={(e) => handlePeriodChange(e.target.value)} className="input">
              <option value="custom">Custom Range</option>
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block font-medium text-gray-700">Start Date</label>
            <input
              type="date"
              value={dateRange.start_date}
              max={dateRange.end_date || undefined}
              onChange={(e) => { setDateRange({ ...dateRange, start_date: e.target.value }); setPeriod('custom'); }}
              className="input"
            />
          </div>
          <div>
            <label className="mb-2 block font-medium text-gray-700">End Date</label>
            <input
              type="date"
              value={dateRange.end_date}
              min={dateRange.start_date || undefined}
              onChange={(e) => { setDateRange({ ...dateRange, end_date: e.target.value }); setPeriod('custom'); }}
              className="input"
            />
          </div>
          <p className="text-sm text-gray-500">Date filtering uses each report’s relevant date, such as join date, attendance date, or leave period.</p>
        </div>
        {period !== 'all' && !hasValidDateRange && (
          <p role="alert" className="mt-3 text-sm font-medium text-red-600">Choose a valid date range. The start date must be on or before the end date.</p>
        )}
      </div>

      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            {[
              { label: 'Total Employees', value: dashboardStats.totalEmployees, color: 'bg-blue-50 text-blue-700' },
              { label: 'Active Employees', value: dashboardStats.activeEmployees, color: 'bg-green-50 text-green-700' },
              { label: 'Present Today', value: dashboardStats.presentToday, color: 'bg-amber-50 text-amber-700' },
              { label: 'Pending Leaves', value: dashboardStats.pendingLeaves, color: 'bg-purple-50 text-purple-700' },
              { label: 'Expiring Soon', value: dashboardStats.expiringSoon, color: 'bg-red-50 text-red-700' },
            ].map((stat) => (
              <div key={stat.label} className={`rounded-xl p-4 border border-gray-200 ${stat.color}`}>
                <p className="text-sm font-medium">{stat.label}</p>
                <p className="text-3xl font-extrabold mt-2">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="card">
              <h2 className="text-xl font-bold mb-4">Department Summary</h2>
              <div className="space-y-3">
                {Object.entries(
                  employees.reduce((acc, emp) => {
                    acc[emp.department] = (acc[emp.department] || 0) + 1;
                    return acc;
                  }, {})
                ).map(([department, count]) => (
                  <div key={department} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                    <span className="font-medium text-gray-700">{department}</span>
                    <span className="font-bold text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h2 className="text-xl font-bold mb-4">Upcoming Expiry Alerts</h2>
              <div className="space-y-3">
                {upcomingExpiries.length ? upcomingExpiries.map((item, index) => (
                  <div key={`${item.empCode}-${item.type}-${index}`} className="flex items-center justify-between bg-red-50 p-3 rounded-lg">
                    <div>
                      <p className="font-semibold text-gray-800">{item.employee}</p>
                      <p className="text-xs text-gray-500">{item.type}</p>
                    </div>
                    <span className="text-sm font-bold text-red-700">{item.expiry}</span>
                  </div>
                )) : (
                  <p className="text-gray-500 text-sm">No upcoming expiry alerts.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'employees' && (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex-1 max-w-md">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search employees</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Name, ID, department..."
                className="input w-full"
              />
            </div>
            <button
              onClick={() => {
                setEditingEmployeeId(null);
                setEmployeeForm(emptyEmployeeForm());
                setShowEmployeeForm(true);
              }}
              className="btn btn-primary"
            >
              + Add Employee
            </button>
          </div>

          {showEmployeeForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
              <div className="bg-white rounded-2xl p-6 w-full max-w-5xl h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] shadow-2xl flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-800">{editingEmployeeId ? 'Edit Employee Profile' : 'Register Employee'}</h2>
                  <button type="button" onClick={() => setShowEmployeeForm(false)} className="text-gray-500 hover:text-gray-700">✕</button>
                </div>
                <form onSubmit={handleEmployeeSubmit} className="space-y-6 flex-1 min-h-0 overflow-y-auto pr-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                      <input value={employeeForm.empCode} onChange={(e) => setEmployeeForm({ ...employeeForm, empCode: e.target.value })} className="input" placeholder="EMP005" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                      <input value={employeeForm.fullName} onChange={(e) => setEmployeeForm({ ...employeeForm, fullName: e.target.value })} className="input" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input type="email" value={employeeForm.email} onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })} className="input" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input value={employeeForm.phone} onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })} className="input" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                      <select value={employeeForm.gender} onChange={(e) => setEmployeeForm({ ...employeeForm, gender: e.target.value })} className="input">
                        <option>Female</option>
                        <option>Male</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nationality</label>
                      <input value={employeeForm.nationality} onChange={(e) => setEmployeeForm({ ...employeeForm, nationality: e.target.value })} className="input" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                      <select value={employeeForm.department} onChange={(e) => setEmployeeForm({ ...employeeForm, department: e.target.value })} className="input">
                        <option>Operations</option>
                        <option>Service</option>
                        <option>Kitchen</option>
                        <option>Finance</option>
                        <option>HR</option>
                        <option>Management</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                      <input value={employeeForm.designation} onChange={(e) => setEmployeeForm({ ...employeeForm, designation: e.target.value })} className="input" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Reporting Manager</label>
                      <select value={employeeForm.manager} onChange={(e) => setEmployeeForm({ ...employeeForm, manager: e.target.value })} className="input">
                        <option value="">None</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.empCode}>{emp.empCode} - {emp.fullName}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Join Date</label>
                      <input type="date" value={employeeForm.joinDate} onChange={(e) => setEmployeeForm({ ...employeeForm, joinDate: e.target.value })} className="input" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Employment Status</label>
                      <select value={employeeForm.employmentStatus} onChange={(e) => setEmployeeForm({ ...employeeForm, employmentStatus: e.target.value })} className="input">
                        <option>Active</option>
                        <option>Probation</option>
                        <option>On Leave</option>
                        <option>Resigned</option>
                        <option>Terminated</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Work Location</label>
                      <input value={employeeForm.workLocation} onChange={(e) => setEmployeeForm({ ...employeeForm, workLocation: e.target.value })} className="input" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Employee Type</label>
                      <select value={employeeForm.employeeType} onChange={(e) => setEmployeeForm({ ...employeeForm, employeeType: e.target.value })} className="input">
                        <option>Full Time</option>
                        <option>Part Time</option>
                        <option>Contract</option>
                        <option>Temporary</option>
                        <option>Commission Based</option>
                        <option>Intern</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Commission Rate (%)</label>
                      <input type="number" min="0" max="100" step="0.01" value={employeeForm.commissionRate} onChange={(e) => setEmployeeForm({ ...employeeForm, commissionRate: e.target.value })} className="input" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Commission Basis</label>
                      <select value={employeeForm.commissionBasis} onChange={(e) => setEmployeeForm({ ...employeeForm, commissionBasis: e.target.value })} className="input">
                        <option>Monthly Sales</option>
                        <option>Individual Sales</option>
                        <option>Collected Revenue</option>
                        <option>Orders Completed</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Probation End</label>
                      <input type="date" value={employeeForm.probationEnd} onChange={(e) => setEmployeeForm({ ...employeeForm, probationEnd: e.target.value })} className="input" />
                    </div>
                    <div className="md:col-span-2 xl:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Residential Address</label>
                      <input value={employeeForm.address} onChange={(e) => setEmployeeForm({ ...employeeForm, address: e.target.value })} className="input" />
                    </div>
                  </div>

                  <div className="border-t pt-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Emergency & Compliance</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact</label>
                        <input value={employeeForm.emergencyName} onChange={(e) => setEmployeeForm({ ...employeeForm, emergencyName: e.target.value })} className="input" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Phone</label>
                        <input value={employeeForm.emergencyPhone} onChange={(e) => setEmployeeForm({ ...employeeForm, emergencyPhone: e.target.value })} className="input" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
                        <input value={employeeForm.relationship} onChange={(e) => setEmployeeForm({ ...employeeForm, relationship: e.target.value })} className="input" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Passport Number</label>
                        <input value={employeeForm.passportNumber} onChange={(e) => setEmployeeForm({ ...employeeForm, passportNumber: e.target.value })} className="input" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Passport Expiry</label>
                        <input type="date" value={employeeForm.passportExpiry} onChange={(e) => setEmployeeForm({ ...employeeForm, passportExpiry: e.target.value })} className="input" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Emirates ID</label>
                        <input value={employeeForm.emiratesId} onChange={(e) => setEmployeeForm({ ...employeeForm, emiratesId: e.target.value })} className="input" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Emirates ID Expiry</label>
                        <input type="date" value={employeeForm.emiratesIdExpiry} onChange={(e) => setEmployeeForm({ ...employeeForm, emiratesIdExpiry: e.target.value })} className="input" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Visa Number</label>
                        <input value={employeeForm.visaNumber} onChange={(e) => setEmployeeForm({ ...employeeForm, visaNumber: e.target.value })} className="input" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Visa Expiry</label>
                        <input type="date" value={employeeForm.visaExpiry} onChange={(e) => setEmployeeForm({ ...employeeForm, visaExpiry: e.target.value })} className="input" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Work Permit Number</label>
                        <input value={employeeForm.workPermitNumber} onChange={(e) => setEmployeeForm({ ...employeeForm, workPermitNumber: e.target.value })} className="input" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Work Permit Expiry</label>
                        <input type="date" value={employeeForm.workPermitExpiry} onChange={(e) => setEmployeeForm({ ...employeeForm, workPermitExpiry: e.target.value })} className="input" />
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Education, Experience & Documents</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Education</label>
                        <input value={employeeForm.education} onChange={(e) => setEmployeeForm({ ...employeeForm, education: e.target.value })} className="input" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Experience</label>
                        <input value={employeeForm.experience} onChange={(e) => setEmployeeForm({ ...employeeForm, experience: e.target.value })} className="input" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Documents</label>
                        <input value={employeeForm.documents} onChange={(e) => setEmployeeForm({ ...employeeForm, documents: e.target.value })} className="input" placeholder="Passport, visa, certificates, insurance" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <textarea value={employeeForm.notes} onChange={(e) => setEmployeeForm({ ...employeeForm, notes: e.target.value })} rows="3" className="input" />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <button type="button" onClick={() => setShowEmployeeForm(false)} className="btn bg-gray-200 text-gray-700">Cancel</button>
                    <button type="submit" className="btn btn-primary">{editingEmployeeId ? 'Update Employee' : 'Save Employee'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Worker Type</th>
                  <th>Commission</th>
                  <th>Manager</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Join Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id}>
                    <td className="font-bold text-gray-600">{emp.empCode}</td>
                    <td>
                      <div className="font-bold text-gray-800">{emp.fullName}</div>
                      <div className="text-xs text-gray-500">{emp.email}</div>
                    </td>
                    <td>{emp.department}</td>
                    <td>{emp.designation}</td>
                    <td>{emp.employeeType}</td>
                    <td>{Number(emp.commissionRate || 0).toFixed(2)}%</td>
                    <td>{emp.manager || '—'}</td>
                    <td>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        emp.employmentStatus === 'Active' ? 'bg-green-100 text-green-700' :
                        emp.employmentStatus === 'Probation' ? 'bg-yellow-100 text-yellow-700' :
                        emp.employmentStatus === 'On Leave' ? 'bg-blue-100 text-blue-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {emp.employmentStatus}
                      </span>
                    </td>
                    <td>{emp.workLocation}</td>
                    <td>{emp.joinDate}</td>
                    <td className="space-x-3">
                      <button onClick={() => handleEditEmployee(emp)} className="text-primary-600 font-bold">Edit</button>
                      <button onClick={() => handleDeleteEmployee(emp.id)} className="text-red-600 font-bold">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'attendance' && (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Attendance & Time</h2>
            <button onClick={() => setShowAttendanceForm(true)} className="btn btn-primary">Mark Attendance</button>
          </div>

          <div className="flex flex-wrap gap-4 items-end mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search Employee</label>
              <input type="text" className="input w-full" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Name or ID..." />
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
            <div className="xl:col-span-2 rounded-xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <h3 className="font-bold text-blue-900">AI Attendance Insight</h3>
                <span className="text-xs font-bold text-blue-700">Pattern analysis</span>
              </div>
              <p className="text-sm text-blue-800">{attendanceAiInsight}</p>
              <p className="text-xs text-blue-600 mt-2">This is a rule-based local assistant. Connect an AI provider later for natural-language HR recommendations.</p>
            </div>
            <div className="rounded-xl border border-green-100 bg-green-50 p-4">
              <h3 className="font-bold text-green-900 mb-2">WhatsApp Notifications</h3>
              <p className="text-sm text-green-800">Open a pre-filled WhatsApp message for present, late, or absent attendance.</p>
              <p className="text-xs text-green-700 mt-2">{attendanceNotifications.length} notification{attendanceNotifications.length === 1 ? '' : 's'} logged</p>
            </div>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Status</th>
                  <th>WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttendance.map((record) => (
                  <tr key={record.id}>
                    <td className="font-bold text-gray-500">{record.employeeId}</td>
                    <td className="font-medium">{record.employeeName}</td>
                    <td>{record.date}</td>
                    <td>{record.checkIn}</td>
                    <td>{record.checkOut}</td>
                    <td>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${record.status === 'Present' ? 'bg-green-100 text-green-700' : record.status === 'Late' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                        {record.status}
                      </span>
                    </td>
                    <td>
                      <button onClick={() => sendAttendanceWhatsApp(record)} className="text-green-600 font-bold hover:underline">
                        Send
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAttendanceForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-2xl font-bold mb-4">Mark Attendance</h2>
            <form onSubmit={handleMarkAttendance} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Select Employee</label>
                <select className="input" value={attendanceForm.employeeId} onChange={(e) => setAttendanceForm({ ...attendanceForm, employeeId: e.target.value })} required>
                  <option value="">Choose Employee...</option>
                  {employees.map((emp) => <option key={emp.id} value={emp.empCode}>{emp.empCode} - {emp.fullName}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Date</label>
                  <input type="date" className="input" value={attendanceForm.date} onChange={(e) => setAttendanceForm({ ...attendanceForm, date: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select className="input" value={attendanceForm.status} onChange={(e) => setAttendanceForm({ ...attendanceForm, status: e.target.value })}>
                    <option>Present</option>
                    <option>Absent</option>
                    <option>Late</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Check In</label>
                  <input type="time" className="input" value={attendanceForm.checkIn} onChange={(e) => setAttendanceForm({ ...attendanceForm, checkIn: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Check Out</label>
                  <input type="time" className="input" value={attendanceForm.checkOut} onChange={(e) => setAttendanceForm({ ...attendanceForm, checkOut: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-4 mt-6">
                <button type="button" onClick={() => setShowAttendanceForm(false)} className="btn bg-gray-200 flex-1">Cancel</button>
                <button type="submit" className="btn btn-primary flex-1">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'leaves' && (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Leave Management</h2>
            <button onClick={() => setShowLeaveForm(true)} className="btn btn-primary">New Leave Request</button>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Employee</th>
                  <th>Leave Type</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeaves.map((leave) => (
                  <tr key={leave.id}>
                    <td className="font-bold text-gray-500">{leave.employeeId}</td>
                    <td className="font-medium">{leave.employeeName}</td>
                    <td>{leave.leaveType}</td>
                    <td>{leave.startDate}</td>
                    <td>{leave.endDate}</td>
                    <td>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${leave.status === 'Approved' ? 'bg-green-100 text-green-700' : leave.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                        {leave.status}
                      </span>
                    </td>
                    <td>
                      {leave.status === 'Pending' && (
                        <div className="flex gap-2">
                          <button onClick={() => updateLeaveStatus(leave.id, 'Approved')} className="text-green-600 font-bold hover:underline">Approve</button>
                          <button onClick={() => updateLeaveStatus(leave.id, 'Rejected')} className="text-red-600 font-bold hover:underline">Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'payroll' && (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Payroll & Payslip</h2>
              <p className="text-sm text-gray-500">WPS-ready payroll processing for UAE operations</p>
            </div>
            <div className="flex gap-3 items-center">
              <label className="text-sm font-medium text-gray-700">Month</label>
              <input
                type="month"
                value={selectedPayrollMonth}
                onChange={(e) => setSelectedPayrollMonth(e.target.value)}
                className="input"
              />
              <button onClick={() => {
                setShowPayrollForm(true);
                setPayrollForm({
                  employeeId: employees[0]?.empCode || '',
                  month: selectedPayrollMonth,
                  basicSalary: 0,
                  allowances: 0,
                  overtime: 0,
                  bonus: 0,
                  commission: 0,
                  commissionBase: 0,
                  commissionRate: Number(employees[0]?.commissionRate || 0),
                  deductions: 0,
                  loan: 0,
                  bankName: '',
                  iban: '',
                  wpsStatus: 'Ready',
                  paymentMode: 'Bank Transfer',
                  notes: ''
                });
              }} className="btn btn-primary">+ Add Payroll</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            {[
              { label: 'Employees', value: payrollSummary.totalEmployees, color: 'bg-blue-50 text-blue-700' },
              { label: 'Gross Pay', value: `AED ${payrollSummary.totalGross.toFixed(2)}`, color: 'bg-green-50 text-green-700' },
              { label: 'Deductions', value: `AED ${payrollSummary.totalDeductions.toFixed(2)}`, color: 'bg-amber-50 text-amber-700' },
              { label: 'Loan', value: `AED ${payrollSummary.totalLoan.toFixed(2)}`, color: 'bg-purple-50 text-purple-700' },
              { label: 'Net Pay', value: `AED ${payrollSummary.totalNet.toFixed(2)}`, color: 'bg-red-50 text-red-700' },
            ].map((item) => (
              <div key={item.label} className={`rounded-xl p-4 border border-gray-200 ${item.color}`}>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-2xl font-extrabold mt-2">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Dept</th>
                  <th>Basic</th>
                  <th>Allow.</th>
                  <th>OT</th>
                  <th>Bonus</th>
                  <th>Deductions</th>
                  <th>Net Pay</th>
                  <th>WPS</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayroll.map((entry) => (
                  <tr key={`${entry.employeeId}-${entry.month}`}>
                    <td>
                      <div className="font-bold text-gray-800">{entry.employeeName}</div>
                      <div className="text-xs text-gray-500">{entry.employeeId}</div>
                    </td>
                    <td>{entry.department}</td>
                    <td>AED {Number(entry.basicSalary || 0).toFixed(2)}</td>
                    <td>AED {Number(entry.allowances || 0).toFixed(2)}</td>
                    <td>AED {Number(entry.overtime || 0).toFixed(2)}</td>
                    <td>AED {Number(entry.bonus || 0).toFixed(2)}</td>
                    <td>AED {Number(entry.deductions || 0).toFixed(2)}</td>
                    <td className="font-bold text-green-700">AED {Number(entry.net || 0).toFixed(2)}</td>
                    <td>
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${entry.wpsStatus === 'Ready' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {entry.wpsStatus}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => {
                          setPayrollForm({ ...entry });
                          setShowPayrollForm(true);
                        }}
                        className="text-primary-600 font-bold hover:underline"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showPayrollForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-4xl shadow-2xl my-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">Payroll Details</h2>
              <button onClick={() => setShowPayrollForm(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <form onSubmit={handlePayrollSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                  <select value={payrollForm.employeeId} onChange={(e) => {
                    const employee = employees.find((item) => item.empCode === e.target.value);
                    setPayrollForm({ ...payrollForm, employeeId: e.target.value, commissionRate: Number(employee?.commissionRate || 0) });
                  }} className="input" required>
                    <option value="">Select employee</option>
                    {employees.map((emp) => <option key={emp.id} value={emp.empCode}>{emp.empCode} - {emp.fullName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payroll Month</label>
                  <input type="month" value={payrollForm.month} onChange={(e) => setPayrollForm({ ...payrollForm, month: e.target.value })} className="input" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                  <input value={payrollForm.bankName} onChange={(e) => setPayrollForm({ ...payrollForm, bankName: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IBAN</label>
                  <input value={payrollForm.iban} onChange={(e) => setPayrollForm({ ...payrollForm, iban: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Basic Salary</label>
                  <input type="number" value={payrollForm.basicSalary} onChange={(e) => setPayrollForm({ ...payrollForm, basicSalary: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Allowances</label>
                  <input type="number" value={payrollForm.allowances} onChange={(e) => setPayrollForm({ ...payrollForm, allowances: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Overtime</label>
                  <input type="number" value={payrollForm.overtime} onChange={(e) => setPayrollForm({ ...payrollForm, overtime: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bonus</label>
                  <input type="number" value={payrollForm.bonus} onChange={(e) => setPayrollForm({ ...payrollForm, bonus: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Manual Commission</label>
                  <input type="number" value={payrollForm.commission} onChange={(e) => setPayrollForm({ ...payrollForm, commission: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Commission Base / Sales</label>
                  <input type="number" value={payrollForm.commissionBase} onChange={(e) => setPayrollForm({ ...payrollForm, commissionBase: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Commission Rate (%)</label>
                  <input type="number" min="0" max="100" step="0.01" value={payrollForm.commissionRate} onChange={(e) => setPayrollForm({ ...payrollForm, commissionRate: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deductions</label>
                  <input type="number" value={payrollForm.deductions} onChange={(e) => setPayrollForm({ ...payrollForm, deductions: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loan / Advance</label>
                  <input type="number" value={payrollForm.loan} onChange={(e) => setPayrollForm({ ...payrollForm, loan: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">WPS Status</label>
                  <select value={payrollForm.wpsStatus} onChange={(e) => setPayrollForm({ ...payrollForm, wpsStatus: e.target.value })} className="input">
                    <option>Ready</option>
                    <option>Pending</option>
                    <option>Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
                  <select value={payrollForm.paymentMode} onChange={(e) => setPayrollForm({ ...payrollForm, paymentMode: e.target.value })} className="input">
                    <option>Bank Transfer</option>
                    <option>Cash</option>
                    <option>Cheque</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payroll Notes</label>
                <textarea value={payrollForm.notes} onChange={(e) => setPayrollForm({ ...payrollForm, notes: e.target.value })} rows="3" className="input" />
              </div>

              <div className="rounded-xl bg-gray-50 p-4 border border-gray-200">
                <p className="text-sm text-gray-500 mb-2">Calculated Net Pay</p>
                <p className="text-3xl font-extrabold text-gray-900">
                  AED {(
                    (Number(payrollForm.basicSalary || 0) + Number(payrollForm.allowances || 0) + Number(payrollForm.overtime || 0) + Number(payrollForm.bonus || 0) + calculatedPayrollCommission) -
                    (Number(payrollForm.deductions || 0) + Number(payrollForm.loan || 0))
                  ).toFixed(2)}
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowPayrollForm(false)} className="btn bg-gray-200 text-gray-700">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Payroll</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'recruitment' && (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Recruitment Pipeline</h2>

          {activeTab === 'performance' && (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Performance & Training</h2>
                  <p className="text-sm text-gray-500">Manage reviews, development goals, and employee learning</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => {
                    setEditingPerformanceId(null);
                    setPerformanceForm({ employeeId: employees[0]?.empCode || '', reviewPeriod: '2026 H2', reviewDate: new Date().toISOString().split('T')[0], reviewer: '', rating: 3, goals: '', strengths: '', developmentPlan: '', status: 'Draft' });
                    setShowPerformanceForm(true);
                  }} className="btn btn-primary">+ Add Review</button>
                  <button onClick={() => {
                    setEditingTrainingId(null);
                    setTrainingForm({ employeeId: employees[0]?.empCode || '', course: '', provider: '', startDate: '', completionDate: '', status: 'Planned', cost: 0, certificateExpiry: '' });
                    setShowTrainingForm(true);
                  }} className="btn bg-gray-800 text-white">+ Add Training</button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                  { label: 'Total Reviews', value: performanceSummary.totalReviews, color: 'bg-blue-50 text-blue-700' },
                  { label: 'Completed Reviews', value: performanceSummary.completed, color: 'bg-green-50 text-green-700' },
                  { label: 'Average Rating', value: `${performanceSummary.averageRating} / 5`, color: 'bg-amber-50 text-amber-700' },
                  { label: 'Training Completed', value: performanceSummary.trainingCompleted, color: 'bg-purple-50 text-purple-700' },
                ].map((stat) => (
                  <div key={stat.label} className={`rounded-xl p-4 border border-gray-200 ${stat.color}`}>
                    <p className="text-sm font-medium">{stat.label}</p>
                    <p className="text-3xl font-extrabold mt-2">{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className="card overflow-x-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold">Performance Reviews</h3>
                  <span className="text-sm text-gray-500">{performanceRows.length} records</span>
                </div>
                <table className="table">
                  <thead><tr><th>Employee</th><th>Period</th><th>Reviewer</th><th>Rating</th><th>Review Date</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {performanceRows.map((review) => (
                      <tr key={review.id}>
                        <td><div className="font-bold">{review.employeeName}</div><div className="text-xs text-gray-500">{review.employeeId}</div></td>
                        <td>{review.reviewPeriod}</td>
                        <td>{review.reviewer || '—'}</td>
                        <td className="font-bold text-amber-600">{review.rating} / 5</td>
                        <td>{review.reviewDate}</td>
                        <td><span className={`px-3 py-1 rounded-full text-xs font-bold ${review.status === 'Completed' ? 'bg-green-100 text-green-700' : review.status === 'In Progress' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'}`}>{review.status}</span></td>
                        <td className="space-x-3">
                          <button onClick={() => { setPerformanceForm({ ...review }); setEditingPerformanceId(review.id); setShowPerformanceForm(true); }} className="text-primary-600 font-bold">Edit</button>
                          <button onClick={() => deletePerformanceReview(review.id)} className="text-red-600 font-bold">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="card overflow-x-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold">Training Records</h3>
                  <span className="text-sm text-gray-500">{trainingRows.length} records</span>
                </div>
                <table className="table">
                  <thead><tr><th>Employee</th><th>Course</th><th>Provider</th><th>Start</th><th>Completion</th><th>Status</th><th>Cost</th><th>Actions</th></tr></thead>
                  <tbody>
                    {trainingRows.map((training) => (
                      <tr key={training.id}>
                        <td><div className="font-bold">{training.employeeName}</div><div className="text-xs text-gray-500">{training.employeeId}</div></td>
                        <td>{training.course}</td>
                        <td>{training.provider || '—'}</td>
                        <td>{training.startDate || '—'}</td>
                        <td>{training.completionDate || '—'}</td>
                        <td><span className={`px-3 py-1 rounded-full text-xs font-bold ${training.status === 'Completed' ? 'bg-green-100 text-green-700' : training.status === 'Scheduled' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>{training.status}</span></td>
                        <td>AED {Number(training.cost || 0).toFixed(2)}</td>
                        <td className="space-x-3">
                          <button onClick={() => { setTrainingForm({ ...training }); setEditingTrainingId(training.id); setShowTrainingForm(true); }} className="text-primary-600 font-bold">Edit</button>
                          <button onClick={() => deleteTrainingRecord(training.id)} className="text-red-600 font-bold">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {showPerformanceForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
              <div className="bg-white rounded-2xl p-6 w-full max-w-3xl shadow-2xl my-8">
                <div className="flex justify-between items-center mb-4"><h2 className="text-2xl font-bold">{editingPerformanceId ? 'Edit Performance Review' : 'Add Performance Review'}</h2><button onClick={() => setShowPerformanceForm(false)} className="text-gray-500">✕</button></div>
                <form onSubmit={handlePerformanceSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium mb-1">Employee</label><select value={performanceForm.employeeId} onChange={(e) => setPerformanceForm({ ...performanceForm, employeeId: e.target.value })} className="input" required><option value="">Select employee</option>{employees.map((employee) => <option key={employee.id} value={employee.empCode}>{employee.empCode} - {employee.fullName}</option>)}</select></div>
                    <div><label className="block text-sm font-medium mb-1">Review Period</label><input value={performanceForm.reviewPeriod} onChange={(e) => setPerformanceForm({ ...performanceForm, reviewPeriod: e.target.value })} className="input" required /></div>
                    <div><label className="block text-sm font-medium mb-1">Review Date</label><input type="date" value={performanceForm.reviewDate} onChange={(e) => setPerformanceForm({ ...performanceForm, reviewDate: e.target.value })} className="input" required /></div>
                    <div><label className="block text-sm font-medium mb-1">Reviewer</label><input value={performanceForm.reviewer} onChange={(e) => setPerformanceForm({ ...performanceForm, reviewer: e.target.value })} className="input" /></div>
                    <div><label className="block text-sm font-medium mb-1">Rating</label><select value={performanceForm.rating} onChange={(e) => setPerformanceForm({ ...performanceForm, rating: e.target.value })} className="input"><option value="1">1 - Needs improvement</option><option value="2">2 - Developing</option><option value="3">3 - Meets expectations</option><option value="4">4 - Exceeds expectations</option><option value="5">5 - Outstanding</option></select></div>
                    <div><label className="block text-sm font-medium mb-1">Status</label><select value={performanceForm.status} onChange={(e) => setPerformanceForm({ ...performanceForm, status: e.target.value })} className="input"><option>Draft</option><option>In Progress</option><option>Completed</option></select></div>
                    <div className="md:col-span-2"><label className="block text-sm font-medium mb-1">Goals</label><textarea value={performanceForm.goals} onChange={(e) => setPerformanceForm({ ...performanceForm, goals: e.target.value })} className="input" rows="2" /></div>
                    <div className="md:col-span-2"><label className="block text-sm font-medium mb-1">Strengths</label><textarea value={performanceForm.strengths} onChange={(e) => setPerformanceForm({ ...performanceForm, strengths: e.target.value })} className="input" rows="2" /></div>
                    <div className="md:col-span-2"><label className="block text-sm font-medium mb-1">Development Plan</label><textarea value={performanceForm.developmentPlan} onChange={(e) => setPerformanceForm({ ...performanceForm, developmentPlan: e.target.value })} className="input" rows="2" /></div>
                  </div>
                  <div className="flex justify-end gap-3 border-t pt-4"><button type="button" onClick={() => setShowPerformanceForm(false)} className="btn bg-gray-200">Cancel</button><button type="submit" className="btn btn-primary">Save Review</button></div>
                </form>
              </div>
            </div>
          )}

          {showTrainingForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
              <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl my-8">
                <div className="flex justify-between items-center mb-4"><h2 className="text-2xl font-bold">{editingTrainingId ? 'Edit Training' : 'Add Training'}</h2><button onClick={() => setShowTrainingForm(false)} className="text-gray-500">✕</button></div>
                <form onSubmit={handleTrainingSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium mb-1">Employee</label><select value={trainingForm.employeeId} onChange={(e) => setTrainingForm({ ...trainingForm, employeeId: e.target.value })} className="input" required><option value="">Select employee</option>{employees.map((employee) => <option key={employee.id} value={employee.empCode}>{employee.empCode} - {employee.fullName}</option>)}</select></div>
                    <div><label className="block text-sm font-medium mb-1">Course</label><input value={trainingForm.course} onChange={(e) => setTrainingForm({ ...trainingForm, course: e.target.value })} className="input" required /></div>
                    <div><label className="block text-sm font-medium mb-1">Provider</label><input value={trainingForm.provider} onChange={(e) => setTrainingForm({ ...trainingForm, provider: e.target.value })} className="input" /></div>
                    <div><label className="block text-sm font-medium mb-1">Status</label><select value={trainingForm.status} onChange={(e) => setTrainingForm({ ...trainingForm, status: e.target.value })} className="input"><option>Planned</option><option>Scheduled</option><option>In Progress</option><option>Completed</option><option>Cancelled</option></select></div>
                    <div><label className="block text-sm font-medium mb-1">Start Date</label><input type="date" value={trainingForm.startDate} onChange={(e) => setTrainingForm({ ...trainingForm, startDate: e.target.value })} className="input" /></div>
                    <div><label className="block text-sm font-medium mb-1">Completion Date</label><input type="date" value={trainingForm.completionDate} onChange={(e) => setTrainingForm({ ...trainingForm, completionDate: e.target.value })} className="input" /></div>
                    <div><label className="block text-sm font-medium mb-1">Cost</label><input type="number" value={trainingForm.cost} onChange={(e) => setTrainingForm({ ...trainingForm, cost: e.target.value })} className="input" /></div>
                    <div><label className="block text-sm font-medium mb-1">Certificate Expiry</label><input type="date" value={trainingForm.certificateExpiry} onChange={(e) => setTrainingForm({ ...trainingForm, certificateExpiry: e.target.value })} className="input" /></div>
                  </div>
                  <div className="flex justify-end gap-3 border-t pt-4"><button type="button" onClick={() => setShowTrainingForm(false)} className="btn bg-gray-200">Cancel</button><button type="submit" className="btn btn-primary">Save Training</button></div>
                </form>
              </div>
            </div>
          )}
              <p className="text-sm text-gray-500">Track hiring, interviews, and candidate decisions</p>
            </div>
            <button
              onClick={() => {
                setEditingCandidateId(null);
                setRecruitmentForm({
                  candidateName: '',
                  position: '',
                  department: 'Operations',
                  source: 'Career Portal',
                  applicationDate: new Date().toISOString().split('T')[0],
                  interviewDate: '',
                  status: 'Applied',
                  contact: '',
                  email: '',
                  experience: '',
                  salaryExpectation: 0,
                  notes: ''
                });
                setShowRecruitmentForm(true);
              }}
              className="btn btn-primary"
            >
              + Add Candidate
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: 'Applied', value: recruitmentSummary.applied, color: 'bg-blue-50 text-blue-700' },
              { label: 'Shortlisted', value: recruitmentSummary.shortlisted, color: 'bg-amber-50 text-amber-700' },
              { label: 'Interviewing', value: recruitmentSummary.interviewing, color: 'bg-purple-50 text-purple-700' },
              { label: 'Hired', value: recruitmentSummary.hired, color: 'bg-green-50 text-green-700' },
            ].map((stat) => (
              <div key={stat.label} className={`rounded-xl p-4 border border-gray-200 ${stat.color}`}>
                <p className="text-sm font-medium">{stat.label}</p>
                <p className="text-3xl font-extrabold mt-2">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Source</th>
                  <th>Applied</th>
                  <th>Interview</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCandidates.map((candidate) => (
                  <tr key={candidate.id}>
                    <td>
                      <div className="font-bold text-gray-800">{candidate.candidateName}</div>
                      <div className="text-xs text-gray-500">{candidate.email || candidate.contact}</div>
                    </td>
                    <td>{candidate.position}</td>
                    <td>{candidate.department}</td>
                    <td>{candidate.source}</td>
                    <td>{candidate.applicationDate}</td>
                    <td>{candidate.interviewDate || '—'}</td>
                    <td>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${candidate.status === 'Hired' ? 'bg-green-100 text-green-700' : candidate.status === 'Interviewing' ? 'bg-purple-100 text-purple-700' : candidate.status === 'Shortlisted' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                        {candidate.status}
                      </span>
                    </td>
                    <td className="space-x-3">
                      <button onClick={() => handleEditCandidate(candidate)} className="text-primary-600 font-bold">Edit</button>
                      <button onClick={() => handleDeleteCandidate(candidate.id)} className="text-red-600 font-bold">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showRecruitmentForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-3xl shadow-2xl my-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">{editingCandidateId ? 'Edit Candidate' : 'Add Candidate'}</h2>
              <button type="button" onClick={() => setShowRecruitmentForm(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>

            <form onSubmit={handleRecruitmentSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Candidate Name</label>
                  <input value={recruitmentForm.candidateName} onChange={(e) => setRecruitmentForm({ ...recruitmentForm, candidateName: e.target.value })} className="input" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                  <input value={recruitmentForm.position} onChange={(e) => setRecruitmentForm({ ...recruitmentForm, position: e.target.value })} className="input" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select value={recruitmentForm.department} onChange={(e) => setRecruitmentForm({ ...recruitmentForm, department: e.target.value })} className="input">
                    <option>Operations</option>
                    <option>Service</option>
                    <option>Kitchen</option>
                    <option>Finance</option>
                    <option>HR</option>
                    <option>Management</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                  <select value={recruitmentForm.source} onChange={(e) => setRecruitmentForm({ ...recruitmentForm, source: e.target.value })} className="input">
                    <option>Career Portal</option>
                    <option>LinkedIn</option>
                    <option>Referral</option>
                    <option>Agency</option>
                    <option>Walk-in</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Application Date</label>
                  <input type="date" value={recruitmentForm.applicationDate} onChange={(e) => setRecruitmentForm({ ...recruitmentForm, applicationDate: e.target.value })} className="input" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Interview Date</label>
                  <input type="date" value={recruitmentForm.interviewDate} onChange={(e) => setRecruitmentForm({ ...recruitmentForm, interviewDate: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={recruitmentForm.status} onChange={(e) => setRecruitmentForm({ ...recruitmentForm, status: e.target.value })} className="input">
                    <option>Applied</option>
                    <option>Shortlisted</option>
                    <option>Interviewing</option>
                    <option>Offer Sent</option>
                    <option>Hired</option>
                    <option>Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Salary Expectation</label>
                  <input type="number" value={recruitmentForm.salaryExpectation} onChange={(e) => setRecruitmentForm({ ...recruitmentForm, salaryExpectation: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
                  <input value={recruitmentForm.contact} onChange={(e) => setRecruitmentForm({ ...recruitmentForm, contact: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={recruitmentForm.email} onChange={(e) => setRecruitmentForm({ ...recruitmentForm, email: e.target.value })} className="input" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Experience</label>
                  <input value={recruitmentForm.experience} onChange={(e) => setRecruitmentForm({ ...recruitmentForm, experience: e.target.value })} className="input" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea value={recruitmentForm.notes} onChange={(e) => setRecruitmentForm({ ...recruitmentForm, notes: e.target.value })} rows="3" className="input" />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowRecruitmentForm(false)} className="btn bg-gray-200 text-gray-700">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Candidate</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLeaveForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-2xl font-bold mb-4">New Leave Request</h2>
            <form onSubmit={handleLeaveRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Select Employee</label>
                <select className="input" value={leaveForm.employeeId} onChange={(e) => setLeaveForm({ ...leaveForm, employeeId: e.target.value })} required>
                  <option value="">Choose Employee...</option>
                  {employees.map((emp) => <option key={emp.id} value={emp.empCode}>{emp.empCode} - {emp.fullName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Leave Type</label>
                <select className="input" value={leaveForm.leaveType} onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value })}>
                  <option>Annual Leave</option>
                  <option>Sick Leave</option>
                  <option>Emergency Leave</option>
                  <option>Unpaid Leave</option>
                  <option>Maternity Leave</option>
                  <option>Paternity Leave</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Date</label>
                  <input type="date" className="input" value={leaveForm.startDate} onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Date</label>
                  <input type="date" className="input" value={leaveForm.endDate} onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })} required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reason</label>
                <textarea className="input" rows="3" value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}></textarea>
              </div>
              <div className="flex gap-4 mt-6">
                <button type="button" onClick={() => setShowLeaveForm(false)} className="btn bg-gray-200 flex-1">Cancel</button>
                <button type="submit" className="btn btn-primary flex-1">Submit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
