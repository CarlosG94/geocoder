function IsNumeric(value) {
    return (!isNaN(parseFloat(value)) && isFinite(value))
}

function RoundCurrency(value) {
    return RoundFloat(value, 2);
}

function RoundFloat(value, decimals) {
    var factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
}

function LeadingZeroes(value, length) {
    var output = value + "";

    while (output.length < length) {
        output = "0" + output;
    }

    return output;
}

function FormatCurrency(value) {
    if (value >= 0) {
        return "$" + value.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, "$1,");
    } else {
        return "($" + (-value).toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, "$1,") + ")";
    }
}

function FormatFileSize(bytes, si) {
    var thresh = si ? 1000 : 1024;
    if (Math.abs(bytes) < thresh) {
        return bytes + ' B';
    }
    var units = si
        ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
        : ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    var u = -1;
    do {
        bytes /= thresh;
        ++u;
    } while (Math.abs(bytes) >= thresh && u < units.length - 1);
    return bytes.toFixed(1) + ' ' + units[u];
}

function FormatDecimal(value) {
    return value.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, "$1,");
}

function FormatWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function NoNullNumber(value) {
    return +(IsNumeric(value) ? value : 0);
}

function NoNegativeNumber(value) {
    return +(NoNullNumber(value) >= 0 ? NoNullNumber(value) : 0);
}

function FormPopulateNonZeroPositiveField(field, value) {
    if (value) {
        if (IsNumeric(value)) {
            if (value > 0) {
                field.val(value);
            }
        }
    }
}
function FormPopulateNumericField(field, value) {
    if (value) {
        if (IsNumeric(value)) {
            field.val(value);
        }
    }
}