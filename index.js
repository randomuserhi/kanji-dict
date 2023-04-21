(function() {
    "use strict";

    let RHU = window.RHU;
    if (RHU === null || RHU === undefined) throw new Error("No RHU found. Did you import RHU before running?");
    RHU.module({ module: "data", hard: ["RHU.Macro"], trace: new Error() }, function()
    {
        let target = 0;

        let load = RHU.getElementById("load");
        load.onclick = function()
        {
            document.body.replaceChildren(document.createMacro("ui"));
        };

        let kanjiVG = RHU.getElementById("kanjivg");
        kanjiVG.addEventListener("change", function(e)
        {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(e) 
            {
                if (!RHU.exists(window.kanjiDict))
                    window.kanjiDict = new KanjiDict();
                kanjiDict.parse(e.target.result, "KANJI_VG");
                if (++target === 2) load.style.display = "block";
            };
            reader.onprogress = function(e) 
            {
                //console.log(e);
            };
            reader.readAsText(file);
        });

        let kanjiDic = RHU.getElementById("kanjidic");
        kanjiDic.addEventListener("change", function(e)
        {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(e) 
            {
                if (!RHU.exists(window.kanjiDict))
                    window.kanjiDict = new KanjiDict();
                kanjiDict.parse(e.target.result, "KANJI_DIC");
                if (++target === 2) load.style.display = "block";
            };
            reader.onprogress = function(e) 
            {
                //console.log(e);
            };
            reader.readAsText(file);
        });

        let UI = function()
        {

        };
        RHU.Macro(UI, "ui",
            /*HTML*/`
            <rhu-macro rhu-type="table"></rhu-macro>
            `,
            { element: /*HTML*/`<div></div>` });
    
        let TableRow = function()
        {

        };
        TableRow.prototype.write = function(kanji, reading, characters)
        {
            let kanjiWithReading = characters.filter(c => {
                if (RHU.exists(c.readings))
                    return c.readings.includes(reading);
                return false;
            });
            let kanjiInSeries = kanjiWithReading.filter(c => c.readings.length === 1);
            let kanjiWithExtraReadings = kanjiWithReading.filter(c => c.readings.length !== 1);
            let coverage = kanjiWithReading.length / characters.length;
            //let coverage = kanjiInSeries.length / (kanjiWithReading.length);

            this.data = {
                literal: kanji,
                size: kanjiInSeries.length,
                kanjiInSeries: kanjiInSeries.map(k => k.literal).join(""),
                reading: reading,
                coverage: parseFloat(roundStringNumberWithoutTrailingZeroes(coverage * 100, 2)),
                kanjiWithExtraReadings: kanjiWithExtraReadings.map(k => k.literal).join("")
            };

            let k = kanjiDict.get(kanji);
            if (RHU.exists(k)) 
            {
                this.data.frequency = kanjiDict.get(kanji).frequency;
            }
            //else console.warn(`'${kanji}' does not exist within the dictionary.`);

            this.literal.innerHTML = this.data.literal;
            this.frequency.innerHTML = RHU.exists(this.data.frequency) ? this.data.frequency : "--";
            this.size.innerHTML = this.data.size;
            this.kanjiInSeries.innerHTML = this.data.kanjiInSeries;
            this.reading.innerHTML = this.data.reading;
            this.coverage.innerHTML = `${this.data.coverage}%`;
            this.kanjiWithExtraReadings.innerHTML = this.data.kanjiWithExtraReadings;
        };
        RHU.Macro(TableRow, "table-row",
            /*HTML*/`
            <td rhu-id="literal">
            </td>
            <td rhu-id="frequency">
            </td>
            <td rhu-id="size">
            </td>
            <td rhu-id="kanjiInSeries">
            </td>
            <td rhu-id="reading">
            </td>
            <td rhu-id="coverage">
            </td>
            <td rhu-id="kanjiWithExtraReadings">
            </td>
            `,
            { element: /*HTML*/`<tr></tr>` });

        let Table = function()
        {
            window.table = this;
            this.dataRows = [];

            this.addAll();

            let buttons = [
                this.component,
                this.size,
                this.kanjiInSeries,
                this.predictedReading,
                this.coverage,
                this.kanjiWithExtraReadings,
                this.frequency
            ];
            this.active = undefined;
            let set = function(self)
            {
                let chevron = self.querySelector(".chevron").classList;
                if (this.active !== self)
                {
                    this.active = self;
                    chevron.toggle("js-visible", true);
                    chevron.toggle("js-active", false);
                    for (let other of buttons)
                    {
                        if (other !== self)
                        {
                            other.querySelector(".chevron").classList.toggle("js-visible", false);
                        }
                    }
                }
                else
                {
                    chevron.toggle("js-active");
                }
                return chevron.contains("js-active");
            }.bind(this);

            this.size.onclick = function()
            {
                let ascending = set(this.size);
                
                for (let r of this.dataRows) r.remove();

                if (ascending)
                    this.dataRows.sort((a, b) => a.data.size - b.data.size);
                else
                    this.dataRows.sort((a, b) => b.data.size - a.data.size);
                
                for (let r of this.dataRows) this.append(r);
            }.bind(this);
            this.coverage.onclick = function()
            {
                let ascending = set(this.coverage);
                
                for (let r of this.dataRows) r.remove();

                if (ascending)
                    this.dataRows.sort((a, b) => a.data.coverage - b.data.coverage);
                else
                    this.dataRows.sort((a, b) => b.data.coverage - a.data.coverage);
                
                for (let r of this.dataRows) this.append(r);
            }.bind(this);
            this.frequency.onclick = function()
            {
                let ascending = set(this.frequency);
                
                for (let r of this.dataRows) r.remove();

                if (ascending)
                    this.dataRows.sort((a, b) => {
                        a = RHU.exists(a.data.frequency) ? a.data.frequency : Infinity;
                        b = RHU.exists(b.data.frequency) ? b.data.frequency : Infinity;
                        return a - b;
                    });
                else
                    this.dataRows.sort((a, b) => {
                        a = RHU.exists(a.data.frequency) ? a.data.frequency : -1;
                        b = RHU.exists(b.data.frequency) ? b.data.frequency : -1;
                        return b - a;
                    });
                
                for (let r of this.dataRows) this.append(r);
            }.bind(this);

            this.coverage.click();
        };
        Table.prototype.downloadCSV = function()
        {
            let a = document.createElement("a");
            a.setAttribute('href', this.toCSV());
            a.setAttribute('download', "table.csv");
            a.click();
        };
        Table.prototype.toCSV = function()
        {
            let data = "Component,Freq of component,size,Kanji in series,Predicted reading,Reading Coverage,Kanji with extra readings\n";
            for (let row of this.dataRows)
            {
                let r = row.data;
                data += `${r.literal},${RHU.exists(r.frequency) ? r.frequency : ""},${r.size},${r.kanjiInSeries},${r.reading},${r.coverage},${r.kanjiWithExtraReadings}\n`;
            }
            let blob = new Blob([data], {type: "text/plain;charset=utf8"});
            return URL.createObjectURL(blob);
        };
        Table.prototype.addAll = function()
        {
            this.dataRows = [];

            let all = kanjiDict.getAllComponents();
            let incomplete = new Set();
            for (let k of all)
            {
                let missing = this.add(k, false);
                if (RHU.exists(missing))
                    for (let m of missing.values()) incomplete.add(m);
            }
            console.warn(`The following characters were missing reading data:\n${[...incomplete.values()].join("")}`);
        };
        Table.prototype.add = function(kanji, log = true)
        {
            let characters = kanjiDict.getKanjiThatContains(kanji);
            if (characters.length === 0)
            {
                // no characters contain given kanji
                return undefined;
            }

            // 1) Get all readings from characters containing kanji
            let missing = new Set();
            let readings = new Map();
            for (let c of characters)
            {
                if (!RHU.exists(c.readings))
                {
                    missing.add(c.literal);
                    continue;
                }
                for (let reading of c.readings)
                {
                    if (!readings.has(reading))
                        readings.set(reading, 1);
                    else
                        readings.set(reading, readings.get(reading) + 1);
                }
            }

            if (missing.size !== 0 && log)
                console.warn(`The following characters were missing readings:\n${[...missing.values()].join("")}`);

            if (readings.size === 0)
            {
                if (log) console.warn(`No readings were found on any of the characters...`);
                return missing;
            }

            // 2) Sort the readings by most common to least common
            readings = [...readings].sort((a, b) => b[1] - a[1]);

            // 3) Keep the most common reading including readings tied with it 
            let common = readings[0][1];
            //if (common === 1) return missing; // 3.1) If common === 1 then no common reading was found between the characters
            readings = readings.filter(g => g[1] === common).map(r => r[0]);
            
            // 4) Produce each table row for each possible reading
            for (let reading of readings)
            {
                let row = document.createMacro("table-row");
                row.write(kanji, reading, characters);
                this.append(row);
                this.dataRows.push(row);
            }

            return missing;
        };
        RHU.Macro(Table, "table",
            /*HTML*/`
            <tr>
                <td>
                    <button rhu-id="component" class="header-button inactive">
                        <span>Component</span>
                        <span class="chevron"></span>
                    </button>
                </td>
                <td>
                    <button rhu-id="frequency" class="header-button">
                        <span>Freq of component</span>
                        <span class="chevron"></span>
                    </button>
                </td>
                <td>
                    <button rhu-id="size" class="header-button">
                        <span>Size</span>
                        <span class="chevron"></span>
                    </button>
                </td>
                <td>
                    <button rhu-id="kanjiInSeries" class="header-button inactive">
                        <span>Kanji in series</span>
                        <span class="chevron"></span>
                    </button>
                </td>
                <td>
                    <button rhu-id="predictedReading" class="header-button inactive">
                        <span>Predicted reading</span>
                        <span class="chevron"></span>
                    </button>
                </td>
                <td>
                    <button rhu-id="coverage" class="header-button">
                        <span>Readings coverage</span>
                        <span class="chevron"></span>
                    </button>
                </td>
                <td>
                    <button rhu-id="kanjiWithExtraReadings" class="header-button inactive">
                        <span>Kanji with extra readings</span>
                        <span class="chevron"></span>
                    </button>
                </td>
            </tr>
            `,
            { element: /*HTML*/`<table></table>` });

        function roundStringNumberWithoutTrailingZeroes (num, dp) 
        {
            if (arguments.length != 2) throw new Error("2 arguments required");

            num = String(num);
            if (num.indexOf('e+') != -1) {
                // Can't round numbers this large because their string representation
                // contains an exponent, like 9.99e+37
                throw new Error("num too large");
            }
            if (num.indexOf('.') == -1) {
                // Nothing to do
                return num;
            }
            if (num[0] == '-') {
                return "-" + roundStringNumberWithoutTrailingZeroes(num.slice(1), dp)
            }

            var parts = num.split('.'),
                beforePoint = parts[0],
                afterPoint = parts[1],
                shouldRoundUp = afterPoint[dp] >= 5,
                finalNumber;

            afterPoint = afterPoint.slice(0, dp);
            if (!shouldRoundUp) {
                finalNumber = beforePoint + '.' + afterPoint;
            } else if (/^9+$/.test(afterPoint)) {
                // If we need to round up a number like 1.9999, increment the integer
                // before the decimal point and discard the fractional part.
                // We want to do this while still avoiding converting the whole
                // beforePart to a Number (since that could cause loss of precision if
                // beforePart is bigger than Number.MAX_SAFE_INTEGER), so the logic for
                // this is once again kinda complicated.
                // Note we can (and want to) use early returns here because the
                // zero-stripping logic at the end of
                // roundStringNumberWithoutTrailingZeroes does NOT apply here, since
                // the result is a whole number.
                if (/^9+$/.test(beforePoint)) {
                    return "1" + beforePoint.replaceAll("9", "0")
                }
                // Starting from the last digit, increment digits until we find one
                // that is not 9, then stop
                var i = beforePoint.length - 1;
                while (true) {
                    if (beforePoint[i] == '9') {
                        beforePoint = beforePoint.substr(0, i) +
                                     '0' +
                                     beforePoint.substr(i+1);
                        i--;
                    } else {
                        beforePoint = beforePoint.substr(0, i) +
                                     (Number(beforePoint[i]) + 1) +
                                     beforePoint.substr(i+1);
                        break;
                    }
                }
                return beforePoint
            } else {
                // Starting from the last digit, increment digits until we find one
                // that is not 9, then stop
                var i = dp-1;
                while (true) {
                    if (afterPoint[i] == '9') {
                        afterPoint = afterPoint.substr(0, i) +
                                     '0' +
                                     afterPoint.substr(i+1);
                        i--;
                    } else {
                        afterPoint = afterPoint.substr(0, i) +
                                     (Number(afterPoint[i]) + 1) +
                                     afterPoint.substr(i+1);
                        break;
                    }
                }

                finalNumber = beforePoint + '.' + afterPoint;
            }

            // Remove trailing zeroes from fractional part before returning
            return finalNumber.replace(/0+$/, '')
        }
    });
})();