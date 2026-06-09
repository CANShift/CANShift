# Bundled ECU XML catalogue

Source: <https://github.com/janimm/RealDash-extras>
License: Unlicense (public domain)
Fetched: 2026-06-10

The XML files in this directory are vendored copies of the upstream
`RealDash-CAN/XML-files` tree. Vendor folders are renamed to snake_case for
URL safety; original filenames preserved.

`index.json` lists every entry with `{ vendor, file, label, path, sizeBytes }`
so the tuner UI can render a searchable / sortable catalogue without an
extra fetch round-trip.
