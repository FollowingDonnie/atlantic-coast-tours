# Testing Batch

Do not implement these items until the student explicitly asks to apply the batch.

## Pending

1. **Remove customer-facing "live Sheet" language**
   - Observation: Replies such as "The live Sheet shows..." expose an internal
     implementation detail and do not sound natural for a tour customer.
   - Intended direction: State the answer directly or use customer-facing wording
     such as "The current listing shows..." or "Current availability is...".
   - Keep technical provenance in the separate "Checked live" evidence line.

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
