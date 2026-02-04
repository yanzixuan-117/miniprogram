// pages/video/list.js
var util = require('../../utils/util.js')

Page({
  data: {
    videoList: [],
    activeCategory: '',
    loading: false,
    hasMore: true,
    page: 1,
    pageSize: 10
  },

  onLoad: function() {
    this.loadVideos()
  },

  onShow: function() {
    // 刷新列表
    if (this.data.videoList.length > 0) {
      this.loadVideos(true)
    }
  },

  // 映射难度到数字（用于CSS）
  mapDifficulty: function(difficulty) {
    return util.getDifficultyLevel(difficulty)
  },

  // 获取难度显示文本
  getDifficultyText: function(difficulty) {
    return util.getDifficultyText(difficulty)
  },

  // 加载视频列表
  loadVideos: async function(refresh) {
    if (this.data.loading) return

    this.setData({ loading: true })

    try {
      var page = refresh ? 1 : this.data.page
      var where = {
        status: 1
      }

      if (this.data.activeCategory) {
        where.category = this.data.activeCategory
      }

      var res = await util.getList('videos', where, this.data.pageSize, (page - 1) * this.data.pageSize)

      var videoList = res.data || []

      // 格式化数据
      var self = this
      videoList = videoList.map(function(item) {
        var result = {}
        for (var key in item) {
          result[key] = item[key]
        }
        result.durationText = self.formatDuration(item.duration)
        result.difficulty = self.mapDifficulty(item.difficulty)
        result.difficultyText = self.getDifficultyText(item.difficulty)
        return result
      })

      if (refresh) {
        this.setData({
          videoList: videoList,
          page: 1,
          hasMore: videoList.length >= this.data.pageSize
        })
      } else {
        // 手动合并数组
        var mergedList = []
        for (var i = 0; i < this.data.videoList.length; i++) {
          mergedList.push(this.data.videoList[i])
        }
        for (var j = 0; j < videoList.length; j++) {
          mergedList.push(videoList[j])
        }

        this.setData({
          videoList: mergedList,
          page: page + 1,
          hasMore: videoList.length >= this.data.pageSize
        })
      }
    } catch (err) {
      util.showError('加载失败，请重试')
    } finally {
      this.setData({ loading: false })
    }
  },

  // 格式化时长
  formatDuration: function(seconds) {
    return util.formatDuration(seconds)
  },

  // 选择分类
  selectCategory: function(e) {
    var category = e.currentTarget.dataset.category
    this.setData({
      activeCategory: category,
      videoList: [],
      page: 1
    })
    this.loadVideos(true)
  },

  // 跳转搜索
  goToSearch: function() {
    wx.navigateTo({
      url: '/pages/video/search'
    })
  },

  // 观看视频
  watchVideo: function(e) {
    var id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: '/pages/video/detail?id=' + id
    })
  },

  // 加载更多
  loadMore: function() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadVideos()
    }
  },

  onPullDownRefresh: function() {
    this.loadVideos(true)
    setTimeout(function() {
      wx.stopPullDownRefresh()
    }, 1000)
  },

  onReachBottom: function() {
    this.loadMore()
  }
})
