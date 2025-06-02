angular.module('app').controller('BonusManagementController', function($scope, $http, $state) {
  $scope.title = 'Bonus Management';

  // Initialize data containers
  $scope.templates = [];
  $scope.rules = [];
  $scope.instances = [];
  $scope.allocations = [];
  $scope.recentActivity = [];

  // Load dashboard data
  function loadDashboardData() {
    $http.get('/api/bonus/templates').then(function(response) {
      $scope.templates = response.data;
    });

    $http.get('/api/bonus/rules').then(function(response) {
      $scope.rules = response.data;
    });

    $http.get('/api/bonus/instances').then(function(response) {
      $scope.instances = response.data.filter(instance => instance.status === 'active');
    });

    $http.get('/api/bonus/allocations').then(function(response) {
      $scope.allocations = response.data;
    });

    // Get recent activity (last 10 activities)
    $http.get('/api/bonus/activity').then(function(response) {
      $scope.recentActivity = response.data.slice(0, 10);
    });
  }

  // Initialize the dashboard if we're on the main bonus state
  if ($state.current.name === 'home.bonus') {
    loadDashboardData();
  }

  // Navigation helpers for sub-sections
  $scope.navigate = function(section) {
    $state.go('home.bonus.' + section);
  };
});
