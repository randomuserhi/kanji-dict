(function() {
    "use strict";

    let RHU = window.RHU;
    if (RHU === null || RHU === undefined) throw new Error("No RHU found. Did you import RHU before running?");
    RHU.module({ module: "main", hard: ["RHU.Macro", "FileReader", "RHU.eventTarget"], trace: new Error() }, function()
    {
        if (RHU.exists(window.KanjiDict))
            console.warn("Replacing KanjiDict...");

        let KanjiDict = window.KanjiDict = function()
        {
            this.dict = new Map();
        };
        KanjiDict.prototype.set = function(k)
        {
            if (this.dict.has(k.literal))
                this.dict.get(k.literal).update(k);
            else
                this.dict.set(k.literal, k);
        };
        KanjiDict.prototype.get = function(kanji)
        {
            return this.dict.get(kanji);
        };
        KanjiDict.prototype.getKanjiThatContains = function(kanji)
        {
            return [...this.dict.values()].filter(k => {
                if (RHU.exists(k.groups))
                    return k.groups.has(kanji);
                return false;
            });
        };
        KanjiDict.prototype.getAllComponents = function()
        {
            let components = new Set();
            for (let k of this.dict.values())
            {
                if (RHU.exists(k.groups))
                    for (let g of k.groups.keys())
                        components.add(g);
            }
            return [...components];
        };

        // UTILITY

        KanjiDict.toHex = function(kanji)
        {
            let kcode = kanji.codePointAt(0);
            let hex = kcode.toString(16);
            let zeros = 5 - hex.length;
            hex = "0".repeat(zeros) + hex;
            return hex;
        };

        KanjiDict.toHexStr = function(kanji)
        {
            let str = [];
            for (let k of kanji)
            {
                str.push(KanjiDict.toHex(k));
            }
            return str;
        };

        // DEFINITIONS

        let RadicalType = KanjiDict.RadicalType = {
            UNKNOWN: "unknown",
            GENERAL: "general",
            NELSON: "nelson",
            TRADIT: "tradit"
        };

        let K = KanjiDict.K = function(literal)
        {
            this.literal = literal;
            this.hex = KanjiDict.toHex(literal);
        }

        let Kanji = KanjiDict.Kanji = function(k)
        {
            this.hex = undefined;
            this.literal = undefined;
            this.radical = undefined; // undefined / null if not a radical, otherwise set to radical type
            this.groups = undefined;
            this.readings = undefined;
            this.meanings = undefined;
            this.frequency = undefined;
            this.update(k);
        };
        Kanji.prototype.update = function(k)
        {
            let keys = Object.keys(this);
            for (let key of keys)
            {
                if (!RHU.exists(this[key]))
                {
                    this[key] = k[key];
                }
            }
        };

        // PARSING

        KanjiDict.prototype.parse = function(data, type)
        {
            switch (type)
            {
            case "KANJI_VG":
            case "KANJI_DIC":
                this[`__${type}__`](data);
                break;
            default:
                throw new Error(`Data of type '${type}' was not recognised.`);
            }
        };
        KanjiDict.prototype.__KANJI_VG__ = function(xmlText)
        {
            let K = KanjiDict.K;

            let parser = new DOMParser();
            let xmlDoc = parser.parseFromString(xmlText, "text/xml");
            
            // Specific translators for KANJIVG xml format
            let RadicalParser = {
                "general": RadicalType.GENERAL,
                "nelson": RadicalType.NELSON,
                "tradit": RadicalType.TRADIT
            };

            // Handle missing combos
            let missingCombos = [
                {
                    literal: "亲",
                    permutations: [ 
                        ["立", "木"] 
                    ]
                },
                {
                    literal: "㐱",
                    permutations: [
                        ["彡", "人"],
                        ["㇒", "㇏", "彡"]
                    ]
                }
            ];

            // Add missing characters from database
            { // 㐱
                let literal = "㐱";
                this.set(new KanjiDict.Kanji({
                    literal: literal,
                    hex: KanjiDict.toHex(literal),
                    groups: new Map([
                        ["人", 1],
                        ["彡", 1],
                        ["丿", 3]
                    ])
                }));
            }
            { // 亲
                let literal = "亲";
                this.set(new KanjiDict.Kanji({
                    literal: literal,
                    hex: KanjiDict.toHex(literal),
                    groups: new Map([
                        ["立", 1],
                        ["木", 1]
                    ])
                }));
            }

            // Ignore weird element groups
            let ignore = [
                //"⿱穴㒸" // Weird character in this database made from 穴 + 㒸 but is denoted as the weird triplet
            ];

            // Translate weird element group names into the correct one
            let translate = {
                "⿱穴㒸": "穴+㒸"
            }

            let iterator = xmlDoc.evaluate("//kanji", xmlDoc);
            for (let kanji; RHU.exists(kanji = iterator.iterateNext());)
            {
                let k = {};

                let groups = kanji.querySelectorAll(":scope > g");
                if (groups.length > 1)
                {
                    console.warn("Kanji character should not contain more than 1 main group... SKIPPING")
                    continue;
                }

                // 1) Obtain character literal

                let root = groups[0]; // Root group => defines the entire character
                k.literal = root.getAttribute("kvg:element"); // obtain root literal (aka the character)
                k.hex = KanjiDict.toHex(k.literal);
                if (root.hasAttribute("kvg:radical")) // check if the character is a radical
                {
                    // If it does, attempt to parse it
                    let raw = root.getAttribute("kvg:radical");
                    k.radical = RadicalParser[raw]; 
                    if (!RHU.exists(k.radical))
                    {
                        k.radical = RadicalType.UNKNOWN;
                        console.warn(`Unknown radical type of '${raw}'.`);
                    }
                }

                // 2) Obtain character components (if there are any)

                let components = kanji.querySelectorAll("g");
                k.groups = new Map();
                for (let component of components)
                {
                    if (component === root) continue;
                    
                    if (component.hasAttribute("kvg:element"))
                    {
                        // 2.1) Check database defined groups 
                        let literal = component.getAttribute("kvg:element");
                        
                        // Ignore groups part of the ignore list
                        if (ignore.includes(literal)) continue;

                        // Translate weird group names into correct ones
                        if (RHU.exists(translate[literal]))
                            literal = translate[literal];

                        if (!k.groups.has(literal))
                            k.groups.set(literal, 1);
                        else
                            k.groups.set(literal, k.groups.get(literal) + 1);
                    }
                    else
                    {
                        // 2.2) Check custom groups that were missing from database
                        for (let missing of missingCombos)
                        {
                            for (let permutation of missing.permutations)
                            {
                                if (component.children.length === permutation.length)
                                {
                                    let match = new Set(permutation);
                                    for (let i = 0; i < component.children.length; ++i)
                                    {
                                        let g = component.children[i];
                                        if (!g.hasAttribute("kvg:element") && !g.hasAttribute("kvg:type")) 
                                            break;
                                        
                                        let literal = g.getAttribute("kvg:element");
                                        if (!RHU.exists(literal)) literal = g.getAttribute("kvg:type");
                                        if (!match.has(literal))
                                            break;

                                        match.delete(literal);
                                    }
                                    if (match.size === 0)
                                    {
                                        if (!k.groups.has(missing.literal))
                                            k.groups.set(missing.literal, 1);
                                        else
                                            k.groups.set(missing.literal, k.groups.get(missing.literal) + 1);
                                    }
                                }
                            }
                        }
                    }
                }

                // 3) Add character to database

                this.set(new KanjiDict.Kanji(k));
            }
        };
        KanjiDict.prototype.__KANJI_DIC__ = function(xmlText)
        {
            let parser = new DOMParser();
            let xmlDoc = parser.parseFromString(xmlText, "text/xml");

            // Add missing characters from database
            { // 㐱
                let literal = "㐱";
                this.set(new KanjiDict.Kanji({
                    literal: literal,
                    hex: KanjiDict.toHex(literal),
                    readings: ["シン"],
                    meanings: ["rash"]
                }));
            }
            { // 亲
                let literal = "亲";
                this.set(new KanjiDict.Kanji({
                    literal: literal,
                    hex: KanjiDict.toHex(literal),
                    readings: ["シン"],
                    meanings: ["relative"]
                }));
            }

            let iterator = xmlDoc.evaluate("//character", xmlDoc);
            for (let kanji; RHU.exists(kanji = iterator.iterateNext());)
            {
                let k = {};

                // 1) Get literal
                let literal = k.literal = kanji.querySelector("literal").textContent;
                k.hex = KanjiDict.toHex(literal);
                
                // 2) Get readings
                k.readings = [];
                for (let reading of kanji.querySelectorAll("reading[r_type='ja_on']"))
                {
                    k.readings.push(reading.textContent)
                }

                // 3) get meanings
                k.meanings = [];
                for (let meaning of kanji.querySelectorAll("meaning:not([m_lang])"))
                {
                    k.meanings.push(meaning.textContent);
                }

                // 4) get frequency if available
                let frequency = kanji.querySelector("freq");
                if (RHU.exists(frequency)) k.frequency = parseInt(frequency.textContent);

                // 5) add to dictionary
                this.set(new KanjiDict.Kanji(k));
            }
        };
    });
})();