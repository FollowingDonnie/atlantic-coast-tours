# Testing Batch

Do not implement these items until the student explicitly asks to apply the batch.

## Pending

None currently.

## Completed During Testing

1. **Demonstrate a live value-swap test**
   - Observation: The assigned Sheet is externally owned, so the student cannot
     edit a value and personally prove that the next answer changes.
   - Test performed: Temporarily pointed the deployed app at an editable Sheet
     copy, changed a distinctive value, and confirmed that the chatbot returned
     the updated value on the next question.
   - Outcome: This proved that tour data is fetched live for each relevant
     question rather than being cached or embedded in the application.
   - Restoration: Returned the app to the assigned Sheet after the successful
     test and ran a final deployed query against the restored source.
   - Assigned Sheet ID: `1balBGf8QhZ5dc-RCCAPt2kcrcf6m_YRh0HL_r8bBtJw`.
   - Temporary test Sheet ID: `12nXCOfCPF3QE-ncJgUdblLyG09tfITVqNYxpNq5zh88`.
   - This is primarily an evidence/testing improvement rather than customer-facing
     functionality.

2. **Remove internal implementation language from customer replies**
   - Observation: Phrases such as "The live Sheet shows..." expose implementation
     details and sound unnatural to a tour customer.
   - Applied change: Updated Maeve's instructions to use customer-facing wording
     such as "The current listing shows..." and "Current availability is...".
   - Added a deterministic response guard for references to Sheets, tools, APIs,
     database rows, source data, models, fetching, querying, and internal searches.
   - Technical provenance remains available separately in the "Checked live"
     evidence line.
   - Added automated regression coverage for the prohibited language.
