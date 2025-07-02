angular.module('app').controller('BonusInstancesController', ['$scope', '$http', 'toastr', '$uibModal', '$ocLazyLoad', '$mdDialog', '$state', function($scope, $http, toastr, $uibModal, $ocLazyLoad, $mdDialog, $state) {
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
                offset: $scope.pagination.offset,
                includeStats: true // Request allocation stats with instances
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
                    $scope.kernel.loading = 100;


                    // Make sure totalAmount and allocationsCount are available for each instance
                    $scope.instances.forEach(function(instance) {
                        // If stats are not provided from the API, fetch them individually
                        if (instance.allocationsCount === undefined || instance.totalAmount === undefined || instance.totalParts === undefined) {
                            $scope.fetchInstanceStats(instance._id);
                        }
                    });
                })
                .catch(function(error) {
                    toastr.error('Failed to load bonus instances');
                    $scope.loading = false;
                    $scope.kernel.loading = 100;
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

        $scope.exportPdf = function(instanceId) {
            $scope.exporting = true;
            toastr.info('Preparing PDF export...');

            $http.get('/api/bonus/instances/' + instanceId + '/export/pdf', {
                responseType: 'arraybuffer'
            })
            .then(function(response) {
                // Create a blob from the PDF data
                var blob = new Blob([response.data], { type: 'application/pdf' });

                // Create a link element to trigger the download
                var downloadLink = document.createElement('a');
                downloadLink.href = URL.createObjectURL(blob);
                downloadLink.download = 'bonus-instance-' + instanceId + '.pdf';

                // Append to the document, click, and remove
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);

                $scope.exporting = false;
                toastr.success('PDF export completed successfully');
            })
            .catch(function(error) {
                $scope.exporting = false;
                toastr.error('Failed to export PDF. Please try again.');
                console.error('PDF export error:', error);
            });
        };

    $scope.exportDocument = function(instance) {
        $scope.exporting = true;
        toastr.info('Preparing bonus export...');

        $http({
            url: '/api/bonus/instances/' + instance._id + '/export',
            method: 'GET',
            responseType: 'arraybuffer', // Important for binary data
            headers: {
                'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }
        })
            .then(function(response) {
                console.log('Export response:', response);
                // Create blob from Excel data
                var blob = new Blob([response.data], {
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                });

                // Try to get filename from content-disposition header
                var fileName = 'bonus-' + (instance.referencePeriod || 'export') + '.xlsx';
                var disposition = response.headers('content-disposition');
                if (disposition) {
                    var filenameMatch = disposition.match(/filename="?([^";]+)"?/);
                    if (filenameMatch && filenameMatch[1]) {
                        fileName = filenameMatch[1];
                    }
                }

                // Create and trigger download
                var downloadLink = document.createElement('a');
                downloadLink.href = URL.createObjectURL(blob);
                downloadLink.download = fileName;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);

                // Clean up
                setTimeout(() => URL.revokeObjectURL(downloadLink.href), 100);

                $scope.exporting = false;
                toastr.success('Bonus export completed successfully');
            })
            .catch(function(error) {
                $scope.exporting = false;
                toastr.error('Failed to export bonus. Please try again.');
                console.error('Export error:', error);
            });
    };

        // Remove the separate export functions and use the unified function instead
        $scope.exportExcel = function(instance) {
            $scope.exportDocument(instance);
        };

        // Instance Form handling
        $scope.createInstance = function() {
            $ocLazyLoad.load('js/controllers/bonus/CreateInstanceCtrl.js').then(function() {
                $mdDialog.show({
                    controller: 'CreateInstanceController',
                    templateUrl: 'templates/bonus/modals/create-instance.html',
                    parent: angular.element(document.body),
                    clickOutsideToClose: true,
                    locals: {
                        templates: $scope.templates
                    }
                }).then(function(response) {
                    toastr.success('Bonus instance created successfully');
                    $scope.loadInstances();
                }, function() {
                    // Dialog cancelled
                });
            });
        };

        // Open the multi-step wizard for managing a bonus instance
        $scope.openWizard = function(instance) {
            $state.go('home.bonus.instance.wizard', {instanceId: instance._id});
        };

        // Add Math to the scope for use in the template
        $scope.Math = window.Math;

        // Fetch allocation stats for a single instance
        $scope.fetchInstanceStats = function(instanceId) {
            $http.get('/api/bonus/instances/' + instanceId + '/allocations/stats')
                .then(function(response) {
                    // Find the instance in our array and update its stats
                    const instanceIndex = $scope.instances.findIndex(instance => instance._id === instanceId);
                    if (instanceIndex !== -1) {
                        $scope.instances[instanceIndex].allocationsCount = response.data.count || 0;
                        $scope.instances[instanceIndex].totalAmount = response.data.totalAmount || 0;
                        $scope.instances[instanceIndex].totalParts = response.data.totalParts || 0;
                    }
                })
                .catch(function(error) {
                    console.error('Failed to fetch allocation stats for instance:', instanceId);
                });
        };

        // Initialize
        loadTemplates();
        $scope.loadInstances();
    }]);
