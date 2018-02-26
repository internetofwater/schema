const util = require('util');
const path = require('path');
const fs = require('fs');

const glob = util.promisify(require('glob'));
const $RefParser = require('json-schema-ref-parser');
const writeFile = util.promisify(fs.writeFile);

console.log('Building JSON Schema & JSON Table Schema & CSV Template');

const srcGlob = __dirname+'/../src/*.json';    // Note files starting w/ `definitions.` will be skipped in code
const csvFile = __dirname+'/../dist/csv/template.csv';
const jsonSchemaDir = __dirname+'/../dist/json-schema';
const jsonTableSchemaDir = __dirname+'/../dist/json-table-schema';

glob(srcGlob)
    .then((files) => {
        const arr = [];
        files.forEach((filePath) => {
            const parts = path.parse(filePath);
            const file = parts.base;
            if (file.indexOf('definitions.') === 0) { return; }    // skip definitions files

            console.log('Processing:', file);

            const jsonSchemaFile = jsonSchemaDir + '/' + file;
            const jsonTableSchemaFile = jsonTableSchemaDir +'/' + file;

            const deref = $RefParser.dereference(filePath)
                .then((schemaJSON) => {
                    //console.log(schemaFile, schemaJSON);

                    const columns = Object.keys(schemaJSON.properties);

                    // csv
                    let csv = `"`+columns.join(`","`)+`"`+"\r\n";

                    // json-schema -> json-schema-table
                    const table = {
                        fields:[]
                    };
                    for(let i = 0, l = columns.length; i<l; i++) {
                        const key = columns[i];
                        const field = schemaJSON.properties[key];
                        const column = {
                            name:key,
                            title:field.title,
                            description:field.description,
                            type:field.type,
                            constraints:{
                                required: (schemaJSON.required.indexOf(key) !== -1) ? true : null
                            }
                        };
                        if (field.hasOwnProperty('format')) {
                            column.format = field.format;
                            if (field.format === 'date-time') {
                                column.format = field.format.replace('-', '');
                            }
                        }

                        const constraints = ['minLength','maxLength','minimum','maximum','pattern','enum'];
                        for(let j = 0, m = constraints.length; j<m; j++) {
                            if (field.hasOwnProperty(constraints[j])) {
                                column.constraints[constraints[j]] = field[constraints[j]];
                            }
                        }

                        table.fields.push(column);
                    }

                    return Promise.all([
                        writeFile(csvFile, csv, {encoding:'utf8'}),
                        writeFile(jsonSchemaFile, JSON.stringify(schemaJSON, null, 2), {encoding:'utf8'}),
                        writeFile(jsonTableSchemaFile, JSON.stringify(table, null, 2), {encoding:'utf8'})
                    ]);
                })
                .catch((err) => {
                    console.error('Error: deref', filePath, err);
                });
            arr.push(deref);
        });
        return Promise.all(arr);
    })
    .then(() => {
        console.log('Done!');
    })
    .catch((err) => {
        console.error('Error: glob', err);
    });

console.log('Copy package.json');
const npm = require(__dirname+'/../package.json');

delete npm.scripts;
delete npm.devDependencies;

fs.writeFileSync(__dirname+'/../dist/package.json', JSON.stringify(npm, null, 2), {encoding:'utf8'});

console.log('Done!');
