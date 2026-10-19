import { useCallback, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CurrencyInput } from '../components/CurrencyInput';
import { FormShell, useActionRunner, useSubmit } from '../components/forms';
import { QuickCaptureModal } from '../components/QuickCaptureModal';
import { AsyncView, Card, EmptyState, Field, FormError, PageHeader } from '../components/ui';
import { useConfirm, type ConfirmRequest } from '../components/useConfirm';
import { api } from '../lib/api';
import { formatBRL, formatDate, todayISO } from '../lib/format';
import { ACCOUNT_TYPE_LABELS } from '../lib/labels';
import { compact, requiredText, validAmount, validDate, type FormErrors } from '../lib/validation';
import { useResource } from '../lib/useResource';
import type { Account, AccountType, Category, Transaction, TransactionType } from '../types';

interface PageData {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
}

type Filter = 'all' | TransactionType;

export default function TransactionsPage() {
  const loader = useCallback(
    () =>
      Promise.all([api.listAccounts(), api.listCategories(), api.listTransactions()]).then(
        ([accounts, categories, transactions]): PageData => ({ accounts, categories, transactions }),
      ),
    [],
  );
  const resource = useResource(loader);
  const confirm = useConfirm();

  return (
    <>
      <PageHeader title="Transações">
        <Link to="/importar" className="btn btn-small">
          Importar extrato →
        </Link>
      </PageHeader>
      <AsyncView
        resource={resource}
        isEmpty={(data) => data.accounts.length === 0}
        empty={
          <EmptyState
            title="Cadastre sua primeira conta"
            description="Contas guardam o saldo: cadastre onde seu dinheiro fica para começar a registrar entradas e gastos."
          >
            <AccountForm onSaved={resource.reload} />
          </EmptyState>
        }
      >
        {(data) => <TransactionsContent data={data} reload={resource.reload} ask={confirm.ask} />}
      </AsyncView>
      {confirm.dialog}
    </>
  );
}

interface ContentProps {
  data: PageData;
  reload: () => void;
  ask: (request: ConfirmRequest) => void;
}

function TransactionsContent({ data, reload, ask }: ContentProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [showQuickModal, setShowQuickModal] = useState(false);
  const { error, run } = useActionRunner(reload);
  const accountName = (id: number) => data.accounts.find((a) => a.id === id)?.name ?? '';
  const categoryName = (id: number) => data.categories.find((c) => c.id === id)?.name ?? '';
  const visible = data.transactions.filter((t) => filter === 'all' || t.type === filter);

  function askDelete(transaction: Transaction) {
    const grouped = Boolean(transaction.installment_group);
    ask({
      title: 'Excluir transação?',
      message: `${transaction.description || 'Transação'} de ${formatBRL(transaction.amount_cents)} em ${formatDate(transaction.date)}.`,
      confirmLabel: grouped ? 'Excluir só esta parcela' : 'Excluir',
      onConfirm: () => run(() => api.deleteTransaction(transaction.id)),
      extraLabel: grouped ? 'Excluir todas as parcelas' : undefined,
      onExtra: () => run(() => api.deleteInstallmentGroup(transaction.installment_group ?? '')),
    });
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowQuickModal(true)}
          aria-label="Adicionar lançamento rápido"
        >
          + Lançamento Rápido
        </button>
      </div>

      <QuickCaptureModal
        isOpen={showQuickModal}
        onClose={() => setShowQuickModal(false)}
        onSaved={reload}
        accounts={data.accounts}
        categories={data.categories}
      />

      <details className="form-details" style={{ marginBottom: '16px' }}>
        <summary>Formulário clássico (opcional)</summary>
        <Card title="Nova transação">
          <TransactionForm accounts={data.accounts} categories={data.categories} onSaved={reload} />
        </Card>
      </details>

      <Card title="Lançamentos">
        <div className="segmented" role="group" aria-label="Filtrar por tipo">
          {(
            [
              ['all', 'Todas'],
              ['income', 'Entradas'],
              ['expense', 'Saídas'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <FormError message={error} />
        {data.transactions.length === 0 ? (
          <EmptyState
            title="Registre sua primeira transação"
            description="Use o formulário acima para lançar uma entrada, um gasto ou uma compra parcelada."
          />
        ) : visible.length === 0 ? (
          <p className="muted">Nenhum lançamento deste tipo.</p>
        ) : (
          <ul className="list" aria-label="Lançamentos">
            {visible.map((transaction) => (
              <li key={transaction.id} className="list-row">
                <div className="grow">
                  <div>{transaction.description || categoryName(transaction.category_id)}</div>
                  <div className="muted">
                    {formatDate(transaction.date)} · {categoryName(transaction.category_id)} ·{' '}
                    {accountName(transaction.account_id)}
                  </div>
                </div>
                <strong className={transaction.type === 'income' ? 'positive' : 'negative'}>
                  {transaction.type === 'income' ? '+' : '-'}
                  {formatBRL(transaction.amount_cents)}
                </strong>
                <button
                  type="button"
                  className="btn btn-small btn-danger"
                  aria-label={`Excluir ${transaction.description || 'transação'}`}
                  onClick={() => askDelete(transaction)}
                >
                  Excluir
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <details className="form-details" style={{ marginTop: '24px' }}>
        <summary>Configurações avançadas (contas e categorias)</summary>
        <Card title="Contas e categorias">
          <div className="grid">
            <ManageList
              title="Contas"
              items={data.accounts.map((a) => ({
                id: a.id,
                label: `${a.name} (${ACCOUNT_TYPE_LABELS[a.type]})`,
                name: a.name,
              }))}
              deleteLabel="Excluir conta"
              onDelete={(item) =>
                ask({
                  title: 'Excluir conta?',
                  message: `A conta ${item.name} será removida. Contas com lançamentos não podem ser excluídas.`,
                  onConfirm: () => run(() => api.deleteAccount(item.id)),
                })
              }
            />
            <ManageList
              title="Categorias"
              items={data.categories.map((c) => ({ id: c.id, label: c.name, name: c.name }))}
              deleteLabel="Excluir categoria"
              onDelete={(item) =>
                ask({
                  title: 'Excluir categoria?',
                  message: `A categoria ${item.name} será removida. Categorias com lançamentos não podem ser excluídas.`,
                  onConfirm: () => run(() => api.deleteCategory(item.id)),
                })
              }
            />
          </div>
          <div className="grid">
            <AccountForm onSaved={reload} />
            <CategoryForm onSaved={reload} />
          </div>
        </Card>
      </details>
    </>
  );
}

interface ManageItem {
  id: number;
  label: string;
  name: string;
}

function ManageList({
  title,
  items,
  deleteLabel,
  onDelete,
}: {
  title: string;
  items: ManageItem[];
  deleteLabel: string;
  onDelete: (item: ManageItem) => void;
}) {
  return (
    <div>
      <h3>{title}</h3>
      <ul className="list" aria-label={title}>
        {items.map((item) => (
          <li key={item.id} className="list-row">
            <span className="grow">{item.label}</span>
            <button
              type="button"
              className="btn btn-small btn-danger"
              aria-label={`${deleteLabel} ${item.name}`}
              onClick={() => onDelete(item)}
            >
              Excluir
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AccountForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [errors, setErrors] = useState<FormErrors>({});
  const { busy, submitError, submit } = useSubmit();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = compact({ name: requiredText(name, 'Informe o nome da conta.') });
    setErrors(found);
    if (await submit(found, () => api.createAccount({ name: name.trim(), type }).then(() => undefined))) {
      setName('');
      onSaved();
    }
  }

  return (
    <FormShell submitLabel="Salvar conta" busy={busy} submitError={submitError} onSubmit={handleSubmit}>
      <Field label="Nome da conta" error={errors.name}>
        {(props) => <input {...props} value={name} onChange={(e) => setName(e.target.value)} />}
      </Field>
      <Field label="Tipo de conta">
        {(props) => (
          <select {...props} value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        )}
      </Field>
    </FormShell>
  );
}

function CategoryForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const { busy, submitError, submit } = useSubmit();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = compact({ name: requiredText(name, 'Informe o nome da categoria.') });
    setErrors(found);
    if (await submit(found, () => api.createCategory({ name: name.trim() }).then(() => undefined))) {
      setName('');
      onSaved();
    }
  }

  return (
    <FormShell
      submitLabel="Adicionar categoria"
      busy={busy}
      submitError={submitError}
      onSubmit={handleSubmit}
    >
      <Field label="Nome da categoria" error={errors.name}>
        {(props) => <input {...props} value={name} onChange={(e) => setName(e.target.value)} />}
      </Field>
    </FormShell>
  );
}

interface TransactionFormProps {
  accounts: Account[];
  categories: Category[];
  onSaved: () => void;
}

function TransactionForm({ accounts, categories, onSaved }: TransactionFormProps) {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => todayISO());
  const [accountId, setAccountId] = useState(String(accounts[0]?.id ?? ''));
  const [categoryId, setCategoryId] = useState(String(categories[0]?.id ?? ''));
  const [description, setDescription] = useState('');
  const [installments, setInstallments] = useState(false);
  const [count, setCount] = useState('2');
  const [errors, setErrors] = useState<FormErrors>({});
  const { busy, submitError, submit } = useSubmit();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = validAmount(amount);
    const parsedCount = Number(count);
    const useInstallments = installments && type === 'expense';
    const found = compact({
      amount: parsedAmount.error,
      date: validDate(date),
      account: accountId ? undefined : 'Selecione uma conta.',
      category: categoryId ? undefined : 'Cadastre ou selecione uma categoria.',
      count:
        useInstallments && !(Number.isInteger(parsedCount) && parsedCount >= 2 && parsedCount <= 48)
          ? 'Use entre 2 e 48 parcelas.'
          : undefined,
    });
    setErrors(found);

    const base = {
      account_id: Number(accountId),
      category_id: Number(categoryId),
      description: description.trim(),
    };
    const saved = await submit(found, async () => {
      const cents = parsedAmount.cents ?? 0;
      if (useInstallments) {
        await api.createInstallments({
          ...base,
          total_cents: cents,
          installments: parsedCount,
          first_date: date,
        });
      } else {
        await api.createTransaction({ ...base, type, amount_cents: cents, date });
      }
    });
    if (saved) {
      setAmount('');
      setDescription('');
      onSaved();
    }
  }

  return (
    <FormShell submitLabel="Salvar transação" busy={busy} submitError={submitError} onSubmit={handleSubmit}>
      <Field label="Tipo">
        {(props) => (
          <select {...props} value={type} onChange={(e) => setType(e.target.value as TransactionType)}>
            <option value="expense">Saída</option>
            <option value="income">Entrada</option>
          </select>
        )}
      </Field>
      <Field label="Valor" error={errors.amount}>
        {(props) => (
          <CurrencyInput
            {...props}
            value={amount}
            onChange={setAmount}
            placeholder="0,00"
            aria-label="Valor"
          />
        )}
      </Field>
      <Field label="Data" error={errors.date}>
        {(props) => <input {...props} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
      </Field>
      <Field label="Conta" error={errors.account}>
        {(props) => (
          <select {...props} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Categoria" error={errors.category}>
        {(props) => (
          <select {...props} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Descrição">
        {(props) => (
          <input
            {...props}
            maxLength={150}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        )}
      </Field>
      {type === 'expense' && (
        <div className="field field-inline">
          <Field label="Parcelar">
            {(props) => (
              <input
                {...props}
                type="checkbox"
                checked={installments}
                onChange={(e) => setInstallments(e.target.checked)}
              />
            )}
          </Field>
        </div>
      )}
      {type === 'expense' && installments && (
        <Field label="Número de parcelas" error={errors.count}>
          {(props) => (
            <input
              {...props}
              type="number"
              min={2}
              max={48}
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
          )}
        </Field>
      )}
    </FormShell>
  );
}
