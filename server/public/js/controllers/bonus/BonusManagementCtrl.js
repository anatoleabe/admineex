angular.module('app').controller('BonusManagementController', function($scope, $http, $state, gettextCatalog) {
  $scope.title = gettextCatalog.getString('Bonus Management');

  // Initialize data containers
  $scope.templates = [];
  $scope.rules = [];
  $scope.instances = [];
  $scope.allocations = [];
  $scope.recentActivity = [];

  // Normalize API responses that may return an array or a paginated shape
  function unpackList(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
  }

  // Load dashboard data
  function loadDashboardData() {
    $http.get('/api/bonus/templates').then(function(response) {
      $scope.templates = unpackList(response.data);
    });

    $http.get('/api/bonus/rules').then(function(response) {
      $scope.rules = unpackList(response.data);
    });

    $http.get('/api/bonus/instances').then(function(response) {
      $scope.instances = unpackList(response.data);
    });

    $http.get('/api/bonus/allocations').then(function(response) {
      $scope.allocations = unpackList(response.data);
    });

    // Get recent activity (last 10 activities)
    $http.get('/api/bonus/activity').then(function(response) {
      var activity = unpackList(response.data);
      $scope.recentActivity = activity.slice(0, 10);
    }).catch(function() {
      // If the endpoint is not available yet, keep the dashboard usable
      $scope.recentActivity = [];
    });
  }

  // Initialize the dashboard
  loadDashboardData();

  // Navigation helpers for sub-sections
  $scope.navigate = function(section) {
    $state.go('home.bonus.' + section);
  };
});
