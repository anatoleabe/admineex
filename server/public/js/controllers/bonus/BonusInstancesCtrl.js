angular.module('app')
    .controller('BonusInstancesController', ['$scope', '$http', 'toastr', '$uibModal', function($scope, $http, toastr, $uibModal) {
        $scope.instances = [];
        $scope.loading = false;
        $scope.filters = {
            status: '',
            templateId: '',
            fromDate: '',
            toDate: ''
        };
        $scope.templates = [];
        $scope.pagination = {
            limit: 10,
            offset: 0,
            total: 0
        };

        // Load bonus templates for filter
        function loadTemplates() {
            $http.get('/api/bonus/templates')
                .then(function(response) {
                    $scope.templates = response.data;
                })
                .catch(function(error) {
                    toastr.error('Failed to load bonus templates');
                });
        }

        // Pagination methods
        $scope.nextPage = function() {
            if (($scope.pagination.offset + $scope.pagination.limit) < $scope.pagination.total) {
                $scope.pagination.offset += $scope.pagination.limit;
                $scope.loadInstances();
            }
        };

        $scope.prevPage = function() {
            if ($scope.pagination.offset > 0) {
                $scope.pagination.offset = Math.max(0, $scope.pagination.offset - $scope.pagination.limit);
                $scope.loadInstances();
            }
        };

        // Load instances with filters
        $scope.loadInstances = function() {
            $scope.loading = true;
            let queryParams = {
                limit: $scope.pagination.limit,
                offset: $scope.pagination.offset
            };

            // Add filters if they are set
            if ($scope.filters.status) queryParams.status = $scope.filters.status;
            if ($scope.filters.templateId) queryParams.templateId = $scope.filters.templateId;
            if ($scope.filters.fromDate) queryParams.fromDate = $scope.filters.fromDate;
            if ($scope.filters.toDate) queryParams.toDate = $scope.filters.toDate;

            $http.get('/api/bonus/instances', { params: queryParams })
                .then(function(response) {
                    $scope.instances = response.data.items;
                    $scope.pagination.total = response.data.total;
                    $scope.loading = false;
                })
                .catch(function(error) {
                    toastr.error('Failed to load bonus instances');
                    $scope.loading = false;
                });
        };

        // Reset filters
        $scope.resetFilters = function() {
            $scope.filters = {
                status: '',
                templateId: '',
                fromDate: '',
                toDate: ''
            };
            $scope.pagination.offset = 0;
            $scope.loadInstances();
        };

        // Actions
        $scope.approve = function(instance) {
            $http.post('/api/bonus/instances/' + instance._id + '/approve')
                .then(function(response) {
                    toastr.success('Instance approved successfully');
                    $scope.loadInstances();
                })
                .catch(function(error) {
                    toastr.error('Failed to approve instance');
                });
        };

        $scope.reject = function(instance) {
            $uibModal.open({
                templateUrl: 'templates/bonus/modals/reject-instance.html',
                controller: 'RejectInstanceModalCtrl',
                resolve: {
                    instance: function() {
                        return instance;
                    }
                }
            }).result.then(function() {
                $scope.loadInstances();
            });
        };

        $scope.generatePayments = function(instance) {
            $http.post('/api/bonus/instances/' + instance._id + '/generate-payments')
                .then(function(response) {
                    toastr.success('Payments generated successfully');
                    $scope.loadInstances();
                })
                .catch(function(error) {
                    toastr.error('Failed to generate payments');
                });
        };

        $scope.export = function(instance) {
            window.location.href = '/api/bonus/instances/' + instance._id + '/export';
        };

        $scope.notify = function(instance) {
            $http.post('/api/bonus/instances/' + instance._id + '/notify')
                .then(function(response) {
                    toastr.success('Notifications sent successfully');
                })
                .catch(function(error) {
                    toastr.error('Failed to send notifications');
                });
        };

        // Initialize
        loadTemplates();
        $scope.loadInstances();
    }]);
