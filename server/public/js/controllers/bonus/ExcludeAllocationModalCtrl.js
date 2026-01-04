angular.module('app')
.controller('ExcludeAllocationModalCtrl', ['$scope', '$http', '$mdDialog', 'toastr', 'allocation', function($scope, $http, $mdDialog, toastr, allocation) {
    function computeIsSansPart(data) {
        if (!data) return false;
        if (data.isSansPart === true) return true;
        if (data.isWithParts === false) return true;
        if (data.isWithParts === true) return false;
        return !!(data.templateId && data.templateId.category === 'without_parts');
    }

    // Initialize the form data
    var isSansPart = computeIsSansPart(allocation);
    var isWithParts = !isSansPart;
    $scope.selectedAllocation = {
        _id: allocation._id,
        personnelId: allocation.personnelId,
        status: allocation.status,
        calculatedAmount: allocation.calculatedAmount || 0,
        finalAmount: allocation.finalAmount || allocation.calculatedAmount || 0,
        calculationInputs: {
            parts: (allocation.calculationInputs && allocation.calculationInputs.parts) || allocation.parts || 0,
            comment: (allocation.calculationInputs && allocation.calculationInputs.comment) || '',
            // expose sans-part fields for display if present
            txPercent: allocation.calculationInputs && allocation.calculationInputs.txPercent,
            sbi: allocation.calculationInputs && allocation.calculationInputs.sbi
        },
        // determine if the template is sans-part
        isSansPart: isSansPart,
        isWithParts: isWithParts
    };
    $scope.isWithParts = isWithParts;

    // Minimum length constant for reason text
    $scope.minReasonLength = 3;

    // Helper: returns trimmed reason
    function getTrimmedReason(){
        return ($scope.selectedAllocation.calculationInputs.comment || '').trim();
    }

    $scope.saveExcludedAllocation = function() {
        if ($scope.excluding) return; // prevent double submit
        if (!$scope.selectedAllocation) return;

        var reason = getTrimmedReason();
        if (!reason || reason.length < $scope.minReasonLength) {
            toastr.error('Please provide a reason (min ' + $scope.minReasonLength + ' characters).');
            return;
        }

        const allocationId = $scope.selectedAllocation._id;
        const fd = new FormData();
        fd.append('reason', reason || 'Manual exclusion');

        $scope.excluding = true;

        $http.post('/api/bonus/allocations/' + allocationId + '/exclude', fd, {
            headers: { 'Content-Type': undefined }
        })
        .then(function(response) {
            $scope.excluding = false;
            $mdDialog.hide(response.data); // return updated allocation to caller
            toastr.success('Allocation excluded');
        })
        .catch(function(error) {
            console.error('Error excluding allocation', error);
            $scope.excluding = false;
            if (error.status === 403) {
                toastr.error('Instance is approved or paid; exclusion not allowed');
            } else if (error.status === 404) {
                toastr.error('Allocation not found');
            } else if (error.data && error.data.message) {
                toastr.error(error.data.message);
            } else {
                toastr.error('Could not exclude allocation');
            }
        });
    };

    $scope.cancel = function() {
        if ($scope.excluding) return; // avoid closing while processing
        $mdDialog.cancel();
    };
}]);
