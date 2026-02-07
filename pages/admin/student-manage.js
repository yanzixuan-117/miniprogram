// pages/admin/student-manage.js
const util = require('../../utils/util.js')

Page({
  data: {
    userList: [],
    loading: false,
    keyword: '',
    roleFilter: 'all', // all, guest, student
    coachList: []
  },

  onLoad() {
    this.checkAdminPermission()
    this.loadUserList()
    this.loadCoachList()
  },

  // 检查管理员权限
  checkAdminPermission() {
    const app = getApp()
    if (!app.isAdmin()) {
      wx.showModal({
        title: '权限提示',
        content: '此功能仅限管理员访问',
        showCancel: false,
        success: () => {
          wx.navigateBack()
        }
      })
    }
  },

  // 加载用户列表
  async loadUserList() {
    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'manageStudent',
        data: {
          action: 'list',
          roleFilter: this.data.roleFilter
        }
      })

      if (res.result.success) {
        let userList = res.result.data || []

        // 关键词搜索筛选
        if (this.data.keyword && this.data.keyword.trim()) {
          const keyword = this.data.keyword.trim().toLowerCase()
          userList = userList.filter(user => {
            const nickname = (user.nickname || '').toLowerCase()
            return nickname.includes(keyword)
          })
        }

        // 格式化注册时间
        userList = userList.map(user => ({
          ...user,
          createTimeText: user.createTime ? util.formatDateCN(new Date(user.createTime)) : ''
        }))

        // 批量转换用户头像云存储URL为临时URL（统一使用 util 工具函数）
        userList = await util.processListCloudURLs(userList, ['cloudAvatarUrl', 'avatarUrl'], '', true)

        this.setData({
          userList: userList
        })

        wx.showToast({
          title: `加载了${userList.length}个用户`,
          icon: 'none',
          duration: 2000
        })
          console.log('用户列表:', userList)
      } else {
        util.showError(res.result.message || '加载失败')
      }
    } catch (err) {
      util.showError('加载失败，请重试')
    } finally {
      this.setData({ loading: false })
    }
  },

  // 加载教练列表（用于添加课程时选择）
  async loadCoachList() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getCoaches',
        data: { status: 1 }
      })

      if (res.result.success) {
        this.setData({
          coachList: res.result.data || []
        })
      }
    } catch (err) {
      console.error('加载教练列表失败:', err)
    }
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({
      keyword: e.detail.value
    })
  },

  // 搜索
  onSearch() {
    this.loadUserList()
  },

  // 角色筛选
  onRoleFilterChange(e) {
    const roleMap = ['all', 'guest', 'student']
    this.setData({
      roleFilter: roleMap[e.detail.value]
    })
    this.loadUserList()
  },

  // 添加为学员
  async addAsStudent(e) {
    const { openid, name, role } = e.currentTarget.dataset

    // 检查是否已经是学员
    if (role === 'student') {
      util.showToast('该用户已经是学员')
      return
    }

    const confirm = await util.showConfirm(`确认将"${name}"添加为学员？`)

    if (!confirm) return

    util.showLoading('添加中...')

    try {
      const res = await wx.cloud.callFunction({
        name: 'manageStudent',
        data: {
          action: 'addAsStudent',
          userId: openid
        }
      })

      if (res.result.success) {
        util.showSuccess('添加成功')
        this.loadUserList()
      } else {
        util.showError(res.result.message || '添加失败')
      }
    } catch (err) {
      util.showError('添加失败，请重试')
    } finally {
      util.hideLoading()
    }
  },

  // 查看学员课程
  viewStudentCourses(e) {
    const { openid, name } = e.currentTarget.dataset
    if (!openid) {
      util.showError('缺少用户ID')
      return
    }
    wx.navigateTo({
      url: `/pages/admin/student-courses?studentOpenid=${openid}&studentName=${encodeURIComponent(name || '学员')}`
    })
  },

  // 添加课程
  addCourse(e) {
    const { openid, name } = e.currentTarget.dataset
    if (!openid) {
      util.showError('缺少用户ID')
      return
    }
    wx.navigateTo({
      url: `/pages/admin/add-course?studentOpenid=${openid}&studentName=${encodeURIComponent(name || '学员')}`
    })
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadUserList()
    setTimeout(() => {
      wx.stopPullDownRefresh()
    }, 1000)
  }
})
