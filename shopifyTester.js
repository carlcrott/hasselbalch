<html>
<head>
<script>
// <![CDATA[

// This is here because of inconsistencies w firefox / chrome handing input.value() as what is in the textbox
(function($) {
  var oldHTML = $.fn.html;

  $.fn.formhtml = function() {
    if (arguments.length) return oldHTML.apply(this,arguments);
    $("input,button", this).each(function() {
      this.setAttribute('value',this.value);
    });
    $("textarea", this).each(function() {
      // updated - thanks Raja!
      this.innerHTML = this.value;
    });
    $("input:radio,input:checkbox", this).each(function() {
      // im not really even sure you need to do this for "checked"
      // but what the heck, better safe than sorry
      if (this.checked) this.setAttribute('checked', 'checked');
      else this.removeAttribute('checked');
    });
    $("option", this).each(function() {
      // also not sure, but, better safe...
      if (this.selected) this.setAttribute('selected', 'selected');
      else this.removeAttribute('selected');
    });
    return oldHTML.apply(this);
  };

  //optional to override real .html() if you want
  // $.fn.html = $.fn.formhtml;
})(jQuery);


function loadScript(url, callback){ 

    var script = document.createElement("script")
    script.type = "text/javascript";
 
    if (script.readyState){  //IE
        script.onreadystatechange = function(){
            if (script.readyState == "loaded" ||
                    script.readyState == "complete"){
                script.onreadystatechange = null;
                callback();
            }
        };
    } else {  //Others
        script.onload = function(){
            callback();
        };
    }
 
    script.src = url;
    document.getElementsByTagName("head")[0].appendChild(script);
}

var myAppJavaScript = function($){

    //// Buffer System Attributes:
    // Change these to update the values which are placed in the input boxes
    //  "System Name":          [pKa        "acid",          acid Mw,       baseHydrates,    "base",         base Mw,    baseHydrates      ]
    var stockBufferSystems = {
        "Sodium phosphate":     [6.82,      "NaH2PO4",       119.98,        [0,2,7,8,12],     "Na2HPO4",      141.96,     [0,2,7,8,12]    ],
        "Tris":                 [8.214,     "Tris-HCl",      157.59,        [0,30,60,90],     "Tris-OH",      121.136,    [0,30,60,90]    ],
        "Ammonium acetate":     [9.25,      "Acetic acid",   60.05,         [0,20,40,60,80],  "NH4-acetate",  77.0825,    [0,20,40,60,80] ],
    }

    // change this to enable running test suite
    var debugOn = true;
    var H2O_MOL_WEIGHT = 18;


    /////////////////////
    //  Establish functions
    /////////////////////

    // enable custom logging
    var log = function() { if (debugOn) { console.log(arguments) } };

    function testMaths() {
        //   buffer name         acid Mw,   base Mw,    pH,     conc,   vol,    acid out,   base out,   pKa 
        testSystems = [
            ['Tris',             157.591,   121.136,    7,      1,      0.5,    '74.26',    '3.49',     8.214],
            ['Sodium phosphate', 119.98,    141.96,     7.4,    1,      0.5,    '12.49',    '56.20',    6.82],
            ['(custom)',         60.05,     77.0825,    8.5,    1,      0.1,    '5.10',     '1.16',     9.25],    
        ];

        for ( i = 0; i < testSystems.length; i++ ) {
            // select system
            $("#buffer_system").val( testSystems[i][0] );

            // input test values
            $("#hh_acid_mw").val( testSystems[i][1] );
            $("#hh_base_mw").val( testSystems[i][2] );
            $("#hh_input_ph").val( testSystems[i][3] );
            $("#hh_input_conc").val( testSystems[i][4] );
            $("#hh_input_vol").val( testSystems[i][5] );
            $("#hh_input_pka").val( testSystems[i][8] );

            // fire off calculation
            $('#hh_run').trigger('click');

            // verify outputs
            if ( $('#hh_req_acid_mass').val() == testSystems[i][6] && $('#hh_req_base_mass').val() == testSystems[i][7] ){
                console.log( "------------ " + testSystems[i][0] + " PASSED!" );
            } else {
                console.log( "------------ " + testSystems[i][0] + " FAILED!" );
            }
        }

        // clear out test residuals
        $("input[id^='hh_']").val("");
        $("#buffer_system").val("Sodium phosphate");
        updateStockBufferSystems();

    }

    // ensure stockBufferSystems is correctly formatted
    function verifyBufferSystemFormatting( obj ) {
        $.each( obj, function(key, value) {
            // TODO: DRY
            typeof( key )      == "string" ? "" : alert('stockBufferSystems key: ' + key + ' should be a string');
            typeof( value[0] ) == "number" ? "" : alert('entry 1 in \"' + key + '\" should be a number');
            typeof( value[1] ) == "string" ? "" : alert('entry 2 in \"' + key + '\" should be a string');
            typeof( value[2] ) == "number" ? "" : alert('entry 3 in \"' + key + '\" should be a number');
            typeof( value[3] ) == "object" ? "" : alert('entry 4 in \"' + key + '\" should be an array');
            typeof( value[4] ) == "string" ? "" : alert('entry 5 in \"' + key + '\" should be a string');
            typeof( value[5] ) == "number" ? "" : alert('entry 6 in \"' + key + '\" should be a number');
            typeof( value[6] ) == "object" ? "" : alert('entry 7 in \"' + key + '\" should be an array');
        });            
    }

    function log10(val) {
        return Math.log(val) / Math.LN10;
    }

    function hendersonHasselbalch() {
        calc_acid = parseFloat( $("#hh_acid_mw").val() );
        calc_base = parseFloat( $("#hh_base_mw").val() );
        desired_final_ph = parseFloat( $("#hh_input_ph").val() )
        desired_final_conc = parseFloat( $("#hh_input_conc").val() )
        desired_final_vol = parseFloat( $("#hh_input_vol").val() )
        desired_final_pKa = $("#hh_input_pka").val();

        bufferSystemName = $("select#buffer_system").val()         

        // base / acid ratio = 10^(desired_final_ph - pKa)
        ratio_base_to_acid = Math.pow(10, desired_final_ph - desired_final_pKa)
        log( "ratio_base_to_acid: " + ratio_base_to_acid );

        // intermediates
        intermediate_molar_acid = desired_final_conc / ( 1 +  ratio_base_to_acid );
        log( "intermediate_molar_acid: " + intermediate_molar_acid );
        intermediate_molar_base = desired_final_conc - intermediate_molar_acid;
        log( "intermediate_molar_base: " + intermediate_molar_base );

        // final
        final_acid_mass = intermediate_molar_acid * calc_acid * desired_final_vol;
        log( "final_acid_mass: " + final_acid_mass );
        final_base_mass = intermediate_molar_base * calc_base * desired_final_vol;
        log( "final_base_mass: " + final_base_mass );

        // Write out required mass for 
        $("#hh_req_acid_mass").val( final_acid_mass.toFixed(2) );
        $("#hh_req_base_mass").val( final_base_mass.toFixed(2) );
    }

    function checkInputFieldPermissions() {
        //////
        // Runs when switching TO custom buffer system
        if ( $('#buffer_system').val() == "(custom)" ) {

            // wipe previous values
            $('#hh_acid_mw').val('');
            $('#hh_base_mw').val('');
            $('#hh_input_pka').val('');

            // enable user input
            $('#hh_acid_mw').prop('disabled', false);
            $('#hh_base_mw').prop('disabled', false);
            $('#hh_input_pka').prop('disabled', false);

            // disable the named buffers
            $('#hh_acid').val("  (custom)  ");
            $('#hh_base').val("  (custom)  ");

            // show hydrates                
            $('#acid_hydrates, #base_hydrates').hide();

        } else {
        //////
        // Runs when switching TO our stock buffer systems

            // enable buffer system drop down
            $('#buffer_system').prop('disabled', false);

            // disable user input
            $('#hh_acid_mw').prop('disabled', true);
            $('#hh_base_mw').prop('disabled', true);
            $('#hh_input_pka').prop('disabled', true);

            // show hydrates                
            $('#acid_hydrates, #base_hydrates').show();

        };
    }

    function updateStockBufferSystems() {
        bufferSystemName = $("select#buffer_system").val();
        log(bufferSystemName);

        checkInputFieldPermissions();

        if ( bufferSystemName != "(custom)" ) {

            // clear out existing hydrate numbers
            $('#acid_hydrates, #base_hydrates').empty();

            // write in acid hydrates into dropdown
            currentAcidHydrates = stockBufferSystems[bufferSystemName][3];
            for (i = 0; i < currentAcidHydrates.length; i++) {
                $('#acid_hydrates').append(
                    $("<option></option>").text( currentAcidHydrates[i] )
                );
            };

            // write in base hydrates into dropdown
            currentBaseHydrates = stockBufferSystems[bufferSystemName][6];
            for (i = 0; i < currentBaseHydrates.length; i++) {
                $('#base_hydrates').append(
                    $("<option></option>").text( currentBaseHydrates[i] )
                );
            };

            $("#hh_input_pka").val(stockBufferSystems[bufferSystemName][0]);
            
            $("#hh_acid").val(stockBufferSystems[bufferSystemName][1]);
            $("#hh_acid_mw").val(stockBufferSystems[bufferSystemName][2]);

            $("#hh_base").val(stockBufferSystems[bufferSystemName][4]);
            $("#hh_base_mw").val(stockBufferSystems[bufferSystemName][5]);
        };
    }

    function calculateHydratedCompoundMw() {
        currentBufferSystem = $('#buffer_system').val();
        // get anhydrous compound Mw from buffer_system
        anhydrousMw = parseFloat( stockBufferSystems[ currentBufferSystem ][2] );
        // calculate the modified hydrous value
        addHydratedMw = parseFloat( $(this).val() ) * H2O_MOL_WEIGHT;
        // replace compound Mw with above value
        $('#hh_' + $(this).attr("id").split("_")[0] + '_mw').val( parseFloat( anhydrousMw + addHydratedMw ).toFixed(3) );
    }


    /////////////////////
    //  Actual page binding 
    /////////////////////

    $(document).ready(function() {
        // On changing the buffer system update the buffer attributes
        $("#buffer_system").on('change', updateStockBufferSystems);
        $("#hh_run").on('click', hendersonHasselbalch );

        // If in debug mode show the button to run tests
        debugOn && $('#hh_run_tests').show().on('click', testMaths);

        verifyBufferSystemFormatting(stockBufferSystems);

        // dynamically populate buffer system dropdown
        $.each(stockBufferSystems, function(key, value) {
            $('#buffer_system').append(
                $("<option></option>").text(key)
            );
        });

        $('#acid_hydrates').bind('change', calculateHydratedCompoundMw);
        $('#base_hydrates').bind('change', calculateHydratedCompoundMw);

        // set page default to first object in stockBufferSystems 
        $('#buffer_system').val( Object.keys( stockBufferSystems )[0] );
        updateStockBufferSystems();

        $('body').append('<p>Your app is using jQuery version '+$.fn.jquery+'</p>');

    }); // end  $(document).ready(function() {


};
  


// Ensure jQuery is installed
if ((typeof jQuery === 'undefined') || (parseFloat(jQuery.fn.jquery) < 1.7)) {
  loadScript('//ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js', function(){
    jQuery191 = jQuery.noConflict(true);
    myAppJavaScript(jQuery191);
  });
} else {
  myAppJavaScript(jQuery);
}



// ]]>

</script>


  <style type="text/css">
      .tg_calc { padding:10px 15px; }
      input[type="text"]{ width:80px; }
      .inline { display: inline-table; }
      .tg  { border-collapse:collapse;border-spacing:0; }
      .tg td, th {
          font-family:Arial, sans-serif;font-size:14px;font-weight:normal;
          padding:10px 5px;
          text-align: center;
          border: 1px solid lightgrey;
          overflow: hidden;
          word-break: normal;
      }
      #hh_run_tests { display: none; };
  </style>

</head>


<body>

  <table class="tg">
    <tr>


  <!-- //////////////////////////////////////
            Buffer System
  ////////////////////////////////////// -->

      <th class="tg_calc">
          buffer system: <br />
          <select id="buffer_system">
              <option>(custom)</option>
          </select>
          <br />
      </th>


  <!-- //////////////////////////////////////
            Acid Name 
  ////////////////////////////////////// -->

      <th class="tg_calc" width="200px">
          acid:<br />
          <input type="text" id="hh_acid" value="NaH2PO4" disabled="disabled" class="inline">
              <div id="acid_hydrates_container" class="inline" >
              &bull;&nbsp;
              <select id="acid_hydrates">
              </select> H20
          </div>
          <br />
      </th>


  <!-- //////////////////////////////////////
            Acid Mw
  ////////////////////////////////////// -->

      <th class="tg_calc">
          acid Mw:<br />
          <input type="text" id="hh_acid_mw" value="119.98" disabled="disabled">
          g/mol
      </th>


  <!-- //////////////////////////////////////
            Base Name
  ////////////////////////////////////// -->

      <th class="tg_calc" width="200px">
          base:<br />
          <input type="text" id="hh_base" value="NA2HPO4" disabled="disabled" class="inline"> 
          <div id="base_hydrates_container" class="inline">
              &bull;&nbsp;
              <select id="base_hydrates">
              </select> H20
          </div>
          <br />
      </th>


  <!-- //////////////////////////////////////
            Base Mw Cell
  ////////////////////////////////////// -->

      <th class="tg_calc">
          base Mw:<br />
          <input type="text" id="hh_base_mw" value="141.96" disabled="disabled">
          g/mol
      </th>
      
    </tr>

    <tr>
      <td class="tg_calc">Enter your requirements:</td>
      <td class="tg_calc">
          pH: <br />
          <input type="text" id="hh_input_ph">
      </td>
      <td class="tg_calc">
          Concentration: <br />
          <input type="text" id="hh_input_conc"> M
      </td>
      <td class="tg_calc">
          Volume: <br />
          <input type="text" id="hh_input_vol"> L
      </td>
      <td class="tg_calc">
          pKa: <br />
          <input type="text" id="hh_input_pka" disabled="disabled">
      </td>
    </tr>

  </table>

  <p> &nbsp; </p>
  <button id="hh_run">calculate</button> <br /> <br />
  <p> &nbsp; </p>



  Results:
  <table class="tg" id="results">
    <tr>
      <td class="tg_calc"> You need</td>
      <td class="tg_calc">
          Acid mass:<br/>
          <input type="text" id="hh_req_acid_mass"> g
      </td>
      <td class="tg_calc">
          Base mass:<br/>
          <input type="text" id="hh_req_base_mass"> g
      </td>
    </tr>

  </table>

  <p> &nbsp; </p>
  <button id="hh_run_tests">run tests</button>


</body>
