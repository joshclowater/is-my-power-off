
$(document).ready(function() {
	$('[name=powerSupplier]').change(function() {
		if ($(this).val() == 'NB_POWER') {
			$('#nb-power-form').show();
		} else {
			$('#nb-power-form').hide();
		}
	});

	$('#registration-form').validate({
		rules: {
        	powerSupplier: {
              required: true
          },
          accountPhoneNumber: {
          	required: function(element) {
          		return $('[name=powerSupplier]').val() == 'NB_POWER'
          				&& $('[name=accountNumber]').val().length == 0;
          	},
          	phoneUS: true
          },
          accountNumber: {
          	required: function(element) {
          		return $('[name=powerSupplier]').val() == 'NB_POWER'
          				&& $('[name=accountPhoneNumber]').val().length == 0;
          	},
          	digits: true,
          	minlength: 8,
          	maxlength: 8
          },
          email: {
              required: true
          },
          confirmPassword: {
              required: true,
              equalTo: '[name=email]'
          }
        },
        messages: {
        	powerSupplier: 'Choose a Power Supplier',
        	accountPhoneNumber: 'A valid 10-digit NB Power phone number (ex. 5064501234) is required (if Account Number is not provided)',
        	accountNumber: 'A valid 8-digit NB Power Account Number (ex. 12345678) is required (if Phone Number is not provided)',
        	inputEmail: 'A valid email is required to have notifications sent to',
        	password: 'At least 8 character password is required for your account',
        	confirmPassword: 'Confirm password must match'
        },
        submitHandler: function (form) {
        	$('#submitting-registration').show();
        	$('#registration-form').hide();
        	$('#errors').html('');

        	var data = getFormData($('#registration-form'));

        	$.post(
						'https://p57pa2ajh2.execute-api.us-east-1.amazonaws.com/beta/%7Bproxy+%7D',
    			  JSON.stringify(data),
        	)
					.done(function() {
						window.location.replace("registrationsubmitted.html");
					})
					.fail(function(result) {
						console.log('result', result);
						if (result && result.responseJSON && result.responseJSON.length > 0) {
							$('#submitting-registration').hide();
							$('#registration-form').show();

							var errors = result.responseJSON;
							$('#errors').append('<br>');
		        	for (var i = 0; i < errors.length; i++) {
		        		$('#errors').append(errors[i] + '<br>');
		        	}
						} else {
							alert('An error occured. Please try again.');
		        	$('#submitting-registration').hide();
		        	$('#registration-form').show();
						}
					});

          return false;
        }
    });
});

function getFormData($form) {
    var unindexed_array = $form.serializeArray();
    var indexed_array = {};

    $.map(unindexed_array, function(n, i){
        indexed_array[n['name']] = n['value'];
    });

    return indexed_array;
}
