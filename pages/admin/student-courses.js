// pages/admin/student-courses.js
const util = require('../../utils/util.js')

Page({
  data: {
    studentOpenid: '',
    studentName: '',
    courseList: [],
    loading: false
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

    this.loadCourseList()
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

  // 加载课程列表
  async loadCourseList() {
    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'manageStudent',
        data: {
          action: 'getStudentCourses',
          userId: this.data.studentOpenid
        }
      })

      if (res.result.success) {
        let courseList = res.result.data || []

        // 格式化日期
        courseList = courseList.map(course => ({
          ...course,
          createTimeText: course.createTime ? util.formatDateCN(new Date(course.createTime)) : '',
          endDateText: course.endDate ? course.endDate : '',
          remainingPercent: course.totalSessions > 0
            ? Math.round((course.remainingSessions / course.totalSessions) * 100)
            : 0
        }))

        this.setData({
          courseList
        })
      } else {
        util.showError(res.result.message || '加载失败')
      }
    } catch (err) {
      console.error('加载课程列表失败:', err)
      util.showError('加载失败，请重试')
    } finally {
      this.setData({ loading: false })
    }
  },

  // 添加课程
  addCourse() {
    const { studentOpenid, studentName } = this.data
    wx.navigateTo({
      url: `/pages/admin/add-course?studentOpenid=${studentOpenid}&studentName=${encodeURIComponent(studentName)}`
    })
  },

  // 删除课程
  async deleteCourse(e) {
    const { courseId, courseName } = e.currentTarget.dataset

    const confirm = await util.showConfirm(`确认删除课程"${courseName}"？`)

    if (!confirm) return

    util.showLoading('删除中...')

    try {
      const res = await wx.cloud.callFunction({
        name: 'manageStudent',
        data: {
          action: 'deleteCourse',
          courseData: {
            courseId: courseId
          }
        }
      })

      if (res.result.success) {
        util.showSuccess('删除成功')
        this.loadCourseList()
      } else {
        util.showError(res.result.message || '删除失败')
      }
    } catch (err) {
      util.showError('删除失败，请重试')
    } finally {
      util.hideLoading()
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadCourseList()
    setTimeout(() => {
      wx.stopPullDownRefresh()
    }, 1000)
  }
})
