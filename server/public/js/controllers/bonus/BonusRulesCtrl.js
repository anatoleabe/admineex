angular.module('app').controller('BonusRulesController', function($scope, $http) {
  $scope.rules = [];
  $scope.loading = true;
  $http.get('/api/bonus/rules').then(function(response) {
    $scope.rules = response.data;
  }).finally(function() {
    $scope.loading = false;
  });
});

