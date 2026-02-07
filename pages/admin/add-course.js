// pages/admin/add-course.js
const util = require('../../utils/util.js')

Page({
  data: {
    studentOpenid: '',
    studentName: '',
    courseName: '',
    totalSessions: '',
    endDate: '',
    coachIndex: -1,
    coachList: [],
    notes: '',
    minDate: new Date().getTime()
  },

  onLoad(options) {
    if (!this.checkAdminPermission()) {
      return
    }

    const { studentOpenid, studentName } = options

    if (!studentOpenid) {
      util.showError('缺少学员信息')
      wx.navigateBack()
      return
    }

    this.setData({
      studentOpenid,
      studentName: decodeURIComponent(studentName || '')
    })

    this.loadCoachList()
  },

  // 检查管理员权限
  checkAdminPermission() {
    const app = getApp()
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      app.globalData.userRole = userInfo.role
    }

    const actualRole = app.globalData.userRole
    if (actualRole !== 'admin') {
      wx.showModal({
        title: '权限提示',
        content: '此功能仅限管理员访问',
        showCancel: false,
        success: () => {
          wx.navigateBack()
        }
      })
      return false
    }
    return true
  },

  // 加载教练列表
  async loadCoachList() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getCoaches',
        data: { status: 1 }
      })

      if (res.result.success) {
        const coachList = res.result.data || []
        this.setData({
          coachList,
          coachArray: coachList.map(c => c.name || c.nickname)
        })
      }
    } catch (err) {
      console.error('加载教练列表失败:', err)
    }
  },

  // 输入课程名称
  onCourseNameInput(e) {
    this.setData({
      courseName: e.detail.value
    })
  },

  // 输入课次
  onSessionsInput(e) {
    this.setData({
      totalSessions: e.detail.value
    })
  },

  // 选择结束日期
  onEndDateChange(e) {
    this.setData({
      endDate: e.detail.value
    })
  },

  // 选择教练
  onCoachChange(e) {
    const index = e.detail.value
    this.setData({
      coachIndex: index,
      selectedCoach: this.data.coachList[index]
    })
  },

  // 输入备注
  onNotesInput(e) {
    this.setData({
      notes: e.detail.value
    })
  },

  // 提交添加课程
  async onSubmit() {
    const { studentOpenid, courseName, totalSessions, endDate, selectedCoach, notes } = this.data

    // 验证必填项
    if (!totalSessions || !endDate) {
      util.showError('请填写完整信息')
      return
    }

    if (parseInt(totalSessions) <= 0) {
      util.showError('课次必须大于0')
      return
    }

    util.showLoading('添加中...')

    try {
      const res = await wx.cloud.callFunction({
        name: 'manageStudent',
        data: {
          action: 'addCourse',
          userId: studentOpenid,
          courseData: {
            courseName: courseName || '网球课程',
            totalSessions: parseInt(totalSessions),
            endDate: endDate,
            coachId: selectedCoach?._openid || '',
            coachName: selectedCoach?.name || selectedCoach?.nickname || '',
            notes: notes || ''
          }
        }
      })

      if (res.result.success) {
        util.showSuccess('添加成功')
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        util.showError(res.result.message || '添加失败')
      }
    } catch (err) {
      util.showError('添加失败，请重试')
    } finally {
      util.hideLoading()
    }
  }
})
